import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendReply, archiveMessage, snoozeMessage } from "@/lib/gmail";
import type { MailflowAction, GmailAccount } from "@/lib/types";

export async function executeAction(action: MailflowAction): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient();

  const { data: digestEmail } = await supabase
    .from("digest_emails")
    .select("*")
    .eq("id", action.digest_email_id)
    .single();

  if (!digestEmail) return { success: false, error: "Digest email not found" };

  const { data: account } = await supabase
    .from("gmail_accounts")
    .select("*")
    .eq("id", digestEmail.account_id)
    .single();

  if (!account) return { success: false, error: "Gmail account not found" };

  try {
    switch (action.action_type) {
      case "send_reply": {
        const payload = action.action_payload as { replyBody: string; to: string; subject: string; threadId: string };
        const result = await sendReply(account as unknown as GmailAccount, payload.threadId, payload.to, payload.subject, payload.replyBody);
        if (!result.sent) return { success: false, error: result.error || "Failed to send reply" };
        break;
      }
      case "archive": {
        const payload = action.action_payload as { gmailMessageId: string };
        const ok = await archiveMessage(account as unknown as GmailAccount, payload.gmailMessageId);
        if (!ok) return { success: false, error: "Failed to archive message" };
        break;
      }
      case "snooze": {
        const payload = action.action_payload as { gmailMessageId: string };
        const ok = await snoozeMessage(account as unknown as GmailAccount, payload.gmailMessageId);
        if (!ok) return { success: false, error: "Failed to snooze message" };
        break;
      }
      default:
        return { success: false, error: `Unknown action type: ${action.action_type}` };
    }

    await supabase
      .from("mailflow_actions")
      .update({ status: "executed", resolved_at: new Date().toISOString() })
      .eq("id", action.id);

    await supabase
      .from("digest_emails")
      .update({ is_actioned: true })
      .eq("id", action.digest_email_id);

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("mailflow_actions")
      .update({ status: "failed", error_message: msg, resolved_at: new Date().toISOString() })
      .eq("id", action.id);
    return { success: false, error: msg };
  }
}
