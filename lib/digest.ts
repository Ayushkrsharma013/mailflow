import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchUnreadMessages, fetchSentMessages, archiveMessage } from "@/lib/gmail";
import { categorizeEmails, draftReplyWithTone, generateDigestSummary } from "@/lib/categorize";
import type { GmailAccount, DigestEmail, MailflowAction, DigestNotificationPayload } from "@/lib/types";

export async function runDigestForUser(userId: string): Promise<{ digestId: string | null; notification: DigestNotificationPayload | null; error?: string }> {
  const supabase = await createSupabaseAdminClient();

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
    const allMessages: { account: GmailAccount; message: Awaited<ReturnType<typeof fetchUnreadMessages>>[0] }[] = [];
    const sentExamples: string[] = [];

    for (const account of accounts as unknown as GmailAccount[]) {
      const messages = await fetchUnreadMessages(account, 50);
      const sent = await fetchSentMessages(account, 5);
      sentExamples.push(...sent);

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
      await supabase.from("digests").update({ status: "completed", total_emails: 0, summary: "No new emails." }).eq("id", digest.id);
      return { digestId: digest.id, notification: null };
    }

    const flatMessages = allMessages.map(m => m.message);
    const categorized = await categorizeEmails(flatMessages);

    const uniqueSentExamples = [...new Set(sentExamples)].slice(0, 5);
    for (const item of allMessages) {
      const cat = categorized.get(item.message.id);
      if (cat?.category === "action_needed" && !cat.draftReply) {
        cat.draftReply = await draftReplyWithTone(item.message, uniqueSentExamples);
      }
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
      .update({
        status: "completed",
        total_emails: allMessages.length,
        categories: categoryCounts,
        summary,
      })
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
