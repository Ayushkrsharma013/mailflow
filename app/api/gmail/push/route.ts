import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchNewMessagesSinceHistory } from "@/lib/gmail";
import { categorizeEmailsBatched, draftRepliesForActions } from "@/lib/categorize";
import { sendUrgentAlertTelegram } from "@/lib/notify";
import type { GmailAccount, MailflowAction } from "@/lib/types";

export async function POST(req: NextRequest) {
  // Verify request is from our Pub/Sub subscription
  const token = process.env.GOOGLE_PUBSUB_TOKEN;
  if (token) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${token}`) {
      console.warn("[Push] Unauthorized push notification rejected");
      return NextResponse.json({ ok: true });
    }
  }

  let emailAddress: string;

  try {
    const body = (await req.json()) as { message?: { data?: string } };
    const decoded = JSON.parse(
      Buffer.from(body.message?.data ?? "", "base64").toString("utf-8")
    ) as { emailAddress?: string; historyId?: string };
    emailAddress = decoded.emailAddress ?? "";
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!emailAddress) return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdminClient();

  const { data: accountRow } = await supabase
    .from("gmail_accounts")
    .select("*")
    .eq("email", emailAddress)
    .eq("is_active", true)
    .maybeSingle();

  if (!accountRow) return NextResponse.json({ ok: true });

  const account = accountRow as unknown as GmailAccount;

  const { messages, newHistoryId } = await fetchNewMessagesSinceHistory(account);

  if (messages.length === 0) {
    if (newHistoryId) {
      await supabase.from("gmail_accounts")
        .update({ gmail_history_id: newHistoryId })
        .eq("id", account.id);
    }
    return NextResponse.json({ ok: true });
  }

  // Filter already-processed messages
  const { data: existing } = await supabase
    .from("digest_emails")
    .select("gmail_message_id")
    .eq("user_id", account.user_id)
    .in("gmail_message_id", messages.map(m => m.id));

  const alreadyProcessed = new Set((existing ?? []).map(e => e.gmail_message_id));
  const newMessages = messages.filter(m => !alreadyProcessed.has(m.id));

  if (newMessages.length === 0) {
    if (newHistoryId) {
      await supabase.from("gmail_accounts")
        .update({ gmail_history_id: newHistoryId })
        .eq("id", account.id);
    }
    return NextResponse.json({ ok: true });
  }

  const categorized = await categorizeEmailsBatched(newMessages);

  const actionMessages = newMessages.filter(
    m => categorized.get(m.id)?.category === "action_needed"
  );
  const draftReplies = await draftRepliesForActions(actionMessages, []);

  // Create a push-triggered digest record
  const { data: pushDigest } = await supabase.from("digests").insert({
    user_id: account.user_id,
    status: "completed",
    total_emails: newMessages.length,
    summary: `Real-time push — ${newMessages.length} new email${newMessages.length > 1 ? "s" : ""}`,
  }).select().single();

  if (!pushDigest) return NextResponse.json({ ok: true });

  const emailRows = newMessages.map(msg => {
    const cat = categorized.get(msg.id);
    return {
      digest_id: pushDigest.id,
      account_id: account.id,
      user_id: account.user_id,
      gmail_message_id: msg.id,
      thread_id: msg.threadId,
      from_email: msg.fromEmail,
      from_name: msg.fromName,
      subject: msg.subject,
      snippet: msg.snippet,
      body_text: msg.bodyText,
      category: (cat?.category ?? "fyi") as "urgent" | "action_needed" | "fyi" | "promotion" | "spam",
      ai_summary: cat?.summary ?? null,
      ai_suggested_action: cat?.suggestedAction ?? null,
      ai_draft_reply: draftReplies.get(msg.id) ?? cat?.draftReply ?? null,
    };
  });

  const { data: insertedEmails } = await supabase
    .from("digest_emails")
    .insert(emailRows)
    .select();

  const actionRows = (insertedEmails ?? [])
    .filter(e => e.category === "action_needed")
    .map(e => ({
      digest_email_id: e.id,
      user_id: account.user_id,
      action_type: "send_reply" as const,
      action_payload: {
        replyBody: e.ai_draft_reply,
        to: e.from_email,
        subject: e.subject,
        threadId: e.thread_id,
        gmailMessageId: e.gmail_message_id,
      },
    }));

  let insertedActions: MailflowAction[] = [];
  if (actionRows.length > 0) {
    const { data: ia } = await supabase.from("mailflow_actions").insert(actionRows).select();
    insertedActions = (ia as MailflowAction[]) ?? [];
  }

  if (newHistoryId) {
    await supabase.from("gmail_accounts")
      .update({ gmail_history_id: newHistoryId, last_synced_at: new Date().toISOString() })
      .eq("id", account.id);
  }

  // Send instant alerts for urgent/action_needed only
  const { data: settings } = await supabase
    .from("mailflow_settings")
    .select("telegram_chat_id")
    .eq("user_id", account.user_id)
    .maybeSingle();

  if (settings?.telegram_chat_id) {
    const alertEmails = (insertedEmails ?? []).filter(
      e => e.category === "urgent" || e.category === "action_needed"
    );
    for (const email of alertEmails) {
      const action = insertedActions.find(a => a.digest_email_id === email.id);
      await sendUrgentAlertTelegram(
        settings.telegram_chat_id as string,
        {
          category: email.category,
          from_name: email.from_name,
          from_email: email.from_email,
          subject: email.subject,
          ai_summary: email.ai_summary,
          snippet: email.snippet,
          ai_draft_reply: email.ai_draft_reply,
        },
        action?.id ?? null
      ).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
