import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchUnreadMessages, fetchSentMessages, archiveMessage, fetchNewMessagesSinceHistory, getGmailHistoryId, fetchMessagesPage } from "@/lib/gmail";
import { categorizeEmails, categorizeEmailsBatched, draftReplyWithTone, draftRepliesForActions, generateDigestSummary } from "@/lib/categorize";
import type { GmailAccount, DigestEmail, MailflowAction, DigestNotificationPayload, GmailMessage } from "@/lib/types";

export async function runDigestForUser(userId: string): Promise<{ digestId: string | null; notification: DigestNotificationPayload | null; error?: string }> {
  const supabase = createSupabaseAdminClient();

  const { data: accounts, error: acctError } = await supabase
    .from("gmail_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (acctError || !accounts?.length) {
    return { digestId: null, notification: null, error: "No active Gmail accounts" };
  }

  const { data: digest, error: digestError } = await supabase
    .from("digests")
    .insert({ user_id: userId, status: "processing" })
    .select()
    .single();

  if (digestError || !digest) {
    return { digestId: null, notification: null, error: "Failed to create digest record" };
  }

  try {
    const allMessages: { account: GmailAccount; message: GmailMessage }[] = [];
    const sentExamples: string[] = [];
    const historyUpdates: { accountId: string; newHistoryId: string }[] = [];

    for (const account of accounts as unknown as GmailAccount[]) {
      const { messages, newHistoryId } = await fetchNewMessagesSinceHistory(account);
      const sent = await fetchSentMessages(account, 5);
      sentExamples.push(...sent);

      if (newHistoryId) {
        historyUpdates.push({ accountId: account.id, newHistoryId });
      }

      for (const msg of messages) {
        const { data: existing } = await supabase
          .from("digest_emails")
          .select("id")
          .eq("gmail_message_id", msg.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) continue;
        allMessages.push({ account, message: msg });
      }

      await supabase
        .from("gmail_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", account.id);
    }

    if (allMessages.length === 0) {
      for (const { accountId, newHistoryId } of historyUpdates) {
        await supabase.from("gmail_accounts")
          .update({ gmail_history_id: newHistoryId })
          .eq("id", accountId);
      }
      await supabase.from("digests").update({ status: "completed", total_emails: 0, summary: "No new emails." }).eq("id", digest.id);
      return { digestId: digest.id, notification: null };
    }

    const flatMessages = allMessages.map(m => m.message);
    const categorized = await categorizeEmailsBatched(flatMessages);

    const uniqueSentExamples = [...new Set(sentExamples)].slice(0, 5);
    const actionMessages = flatMessages.filter(m => categorized.get(m.id)?.category === "action_needed");
    const draftReplies = await draftRepliesForActions(actionMessages, uniqueSentExamples);

    // Merge draft replies back into categorized map
    for (const [id, reply] of draftReplies) {
      const cat = categorized.get(id);
      if (cat) cat.draftReply = reply;
    }

    const summary = await generateDigestSummary(categorized, accounts.length);

    const emailRows: Partial<DigestEmail>[] = [];
    const actionRows: Partial<MailflowAction>[] = [];
    const categoryCounts: Record<string, number> = {};

    for (const item of allMessages) {
      const cat = categorized.get(item.message.id);
      if (!cat) continue;

      categoryCounts[cat.category] = (categoryCounts[cat.category] || 0) + 1;

      emailRows.push({
        digest_id: digest.id,
        account_id: item.account.id,
        user_id: userId,
        gmail_message_id: item.message.id,
        thread_id: item.message.threadId,
        from_email: item.message.fromEmail,
        from_name: item.message.fromName,
        subject: item.message.subject,
        snippet: item.message.snippet,
        body_text: item.message.bodyText,
        category: cat.category,
        ai_summary: cat.summary,
        ai_suggested_action: cat.suggestedAction,
        ai_draft_reply: cat.draftReply,
      });
    }

    const { data: insertedEmails } = await supabase
      .from("digest_emails")
      .insert(emailRows)
      .select();

    // Update historyIds now that emails are safely saved
    for (const { accountId, newHistoryId } of historyUpdates) {
      await supabase.from("gmail_accounts")
        .update({ gmail_history_id: newHistoryId })
        .eq("id", accountId);
    }

    if (insertedEmails) {
      for (const email of insertedEmails) {
        const cat = categorized.get(email.gmail_message_id);
        if (!cat || cat.category !== "action_needed") continue;

        const originalMsg = allMessages.find(m => m.message.id === email.gmail_message_id);
        if (!originalMsg) continue;

        actionRows.push({
          digest_email_id: email.id,
          user_id: userId,
          action_type: "send_reply",
          action_payload: {
            replyBody: cat.draftReply,
            to: originalMsg.message.fromEmail,
            subject: originalMsg.message.subject,
            threadId: originalMsg.message.threadId,
            gmailMessageId: originalMsg.message.id,
          },
        });
      }
    }

    let insertedActions: MailflowAction[] = [];
    if (actionRows.length > 0) {
      const { data: ia } = await supabase
        .from("mailflow_actions")
        .insert(actionRows)
        .select();
      insertedActions = (ia as MailflowAction[]) || [];
    }

    await supabase
      .from("digests")
      .update({ status: "completed", total_emails: allMessages.length, categories: categoryCounts, summary })
      .eq("id", digest.id);

    const { data: settings } = await supabase
      .from("mailflow_settings")
      .select("auto_archive_categories")
      .eq("user_id", userId)
      .maybeSingle();

    const autoArchiveCategories: string[] = (settings as { auto_archive_categories?: string[] } | null)?.auto_archive_categories || ["promotion", "spam"];

    for (const item of allMessages) {
      const cat = categorized.get(item.message.id);
      if (cat && autoArchiveCategories.includes(cat.category)) {
        archiveMessage(item.account, item.message.id).catch(() => {});
      }
    }

    const pendingActions = insertedActions.map(a => {
      const email = insertedEmails?.find(e => e.id === a.digest_email_id);
      return {
        id: a.id,
        fromName: email?.from_name || "Unknown",
        fromEmail: email?.from_email || "",
        subject: email?.subject || "(no subject)",
        actionType: a.action_type,
        draftReply: ((a.action_payload as Record<string, unknown>)?.replyBody as string) || "",
      };
    });

    const notification: DigestNotificationPayload = {
      accountsCount: accounts.length,
      totalEmails: allMessages.length,
      urgentCount: categoryCounts["urgent"] || 0,
      actionCount: categoryCounts["action_needed"] || 0,
      fyiCount: categoryCounts["fyi"] || 0,
      promoCount: categoryCounts["promotion"] || 0,
      spamCount: categoryCounts["spam"] || 0,
      summary: summary || "",
      pendingActions,
    };

    return { digestId: digest.id, notification };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await supabase.from("digests").update({ status: "failed", error_message: msg }).eq("id", digest.id);
    return { digestId: digest.id, notification: null, error: msg };
  }
}

export async function backfillAccount(account: GmailAccount): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const MAX_EMAILS = 500;

  console.log(`[Backfill] Starting historical backfill for ${account.email}`);

  // Collect message IDs via paginated fetch (fetchMessagesPage returns full GmailMessage objects)
  let pageToken: string | undefined;
  const allMessages: GmailMessage[] = [];

  do {
    const { messages, nextPageToken } = await fetchMessagesPage(
      account,
      "in:inbox newer_than:90d",
      100,
      pageToken
    );
    allMessages.push(...messages);
    pageToken = nextPageToken;
  } while (pageToken && allMessages.length < MAX_EMAILS);

  const messagesToProcess = allMessages.slice(0, MAX_EMAILS);

  if (messagesToProcess.length === 0) {
    console.log(`[Backfill] No messages found for ${account.email}`);
    const historyId = await getGmailHistoryId(account);
    if (historyId) {
      await supabase.from("gmail_accounts").update({ gmail_history_id: historyId }).eq("id", account.id);
    }
    return;
  }

  // Skip already-processed messages
  const { data: existing } = await supabase
    .from("digest_emails")
    .select("gmail_message_id")
    .eq("user_id", account.user_id)
    .in("gmail_message_id", messagesToProcess.map(m => m.id));

  const alreadyProcessed = new Set((existing ?? []).map(e => e.gmail_message_id));
  const newMessages = messagesToProcess.filter(m => !alreadyProcessed.has(m.id));

  console.log(`[Backfill] ${account.email}: ${newMessages.length} new messages to categorize`);

  if (newMessages.length === 0) {
    const historyId = await getGmailHistoryId(account);
    if (historyId) {
      await supabase.from("gmail_accounts").update({ gmail_history_id: historyId }).eq("id", account.id);
    }
    return;
  }

  // Categorize in batches of 10
  const categorized = await categorizeEmailsBatched(newMessages);

  // Build category counts
  const categoryCounts = new Map<string, number>();
  for (const cat of categorized.values()) {
    categoryCounts.set(cat.category, (categoryCounts.get(cat.category) ?? 0) + 1);
  }

  // Create a backfill digest record
  const { data: digest } = await supabase.from("digests").insert({
    user_id: account.user_id,
    status: "completed",
    total_emails: newMessages.length,
    summary: `Historical backfill — ${newMessages.length} emails from last 90 days`,
    categories: Object.fromEntries(categoryCounts),
  }).select().single();

  if (!digest) {
    console.error("[Backfill] Failed to create digest record");
    return;
  }

  const emailRows = newMessages.map(msg => {
    const cat = categorized.get(msg.id);
    return {
      digest_id: digest.id,
      account_id: account.id,
      user_id: account.user_id,
      gmail_message_id: msg.id,
      thread_id: msg.threadId,
      from_email: msg.fromEmail,
      from_name: msg.fromName,
      subject: msg.subject,
      snippet: msg.snippet,
      body_text: msg.bodyText,
      category: (cat?.category ?? "fyi") as DigestEmail["category"],
      ai_summary: cat?.summary ?? null,
      ai_suggested_action: cat?.suggestedAction ?? null,
      ai_draft_reply: cat?.draftReply ?? null,
    };
  });

  if (emailRows.length > 0) {
    await supabase.from("digest_emails").insert(emailRows);
  }

  // Store current historyId so ongoing sync starts from here
  const historyId = await getGmailHistoryId(account);
  if (historyId) {
    await supabase.from("gmail_accounts")
      .update({ gmail_history_id: historyId })
      .eq("id", account.id);
  }

  console.log(`[Backfill] Done for ${account.email}: ${newMessages.length} emails processed`);
}
