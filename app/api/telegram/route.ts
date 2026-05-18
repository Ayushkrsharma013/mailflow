import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executeAction } from "@/lib/actions";
import { runDigestForUser } from "@/lib/digest";
import { sendDigestTelegram } from "@/lib/notify";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const callbackQuery = body.callback_query as Record<string, unknown> | undefined;
    if (callbackQuery) {
      const data = (callbackQuery.data as string) || "";
      const msg = callbackQuery.message as Record<string, unknown> | undefined;
      const msgChat = (msg?.chat as Record<string, unknown> | undefined);
      const chatId = String(msgChat?.id || "");

      if (data.startsWith("approve:")) {
        const actionId = data.replace("approve:", "");
        const result = await handleTelegramApproval(actionId, "approved", "telegram");
        await sendTelegramReply(chatId, result.success ? "✅ Reply sent!" : `❌ Failed: ${result.error || "Unknown error"}`);
      } else if (data.startsWith("reject:")) {
        const actionId = data.replace("reject:", "");
        await handleTelegramApproval(actionId, "rejected", "telegram");
        await sendTelegramReply(chatId, "❌ Reply rejected.");
      }

      const callbackId = callbackQuery.id as string;
      if (callbackId) {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackId }),
        });
      }

      return NextResponse.json({ ok: true });
    }

    const message = body.message as Record<string, unknown> | undefined;
    if (message) {
      const text = (message.text as string) || "";
      const msgChat2 = (message.chat as Record<string, unknown> | undefined);
      const chatId = String(msgChat2?.id || "");

      if (text === "/start" || text === "/check-inbox") {
        const supabase = await createSupabaseServerClient();
        const { data: settings } = await supabase
          .from("mailflow_settings")
          .select("user_id")
          .eq("telegram_chat_id", chatId)
          .maybeSingle();

        if (!settings) {
          await sendTelegramReply(chatId, "Your Telegram account is not linked. Go to MailFlow Settings to link it.");
        } else {
          await sendTelegramReply(chatId, "Checking your inbox...");
          const result = await runDigestForUser(settings.user_id);
          if (result.notification) {
            await sendDigestTelegram(chatId, result.notification);
          } else {
            await sendTelegramReply(chatId, result.error || "No new emails found.");
          }
        }
      } else {
        await sendTelegramReply(chatId, "Use /check-inbox to run a digest.");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram webhook]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

async function handleTelegramApproval(actionId: string, status: "approved" | "rejected", approvedBy: string) {
  const supabase = await createSupabaseServerClient();
  const { data: action } = await supabase
    .from("mailflow_actions")
    .select("*")
    .eq("id", actionId)
    .single();

  if (!action) return { success: false, error: "Action not found" };

  await supabase
    .from("mailflow_actions")
    .update({ status, approved_by: approvedBy, resolved_at: new Date().toISOString() })
    .eq("id", actionId);

  if (status === "approved") {
    const refreshed = await supabase.from("mailflow_actions").select("*").eq("id", actionId).single();
    if (refreshed.data) {
      return executeAction(refreshed.data);
    }
  }

  return { success: true };
}

async function sendTelegramReply(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
