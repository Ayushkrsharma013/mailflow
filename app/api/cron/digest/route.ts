import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runDigestForUser } from "@/lib/digest";
import { sendDigestTelegram, sendDigestSlack } from "@/lib/notify";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  if (!expectedAuth || authHeader !== expectedAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: userIds, error } = await supabase
    .from("gmail_accounts")
    .select("user_id")
    .eq("is_active", true);

  if (error || !userIds) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const uniqueUserIds = [...new Set(userIds.map(r => r.user_id))];
  const results: { userId: string; digestId: string | null; error?: string }[] = [];

  for (const userId of uniqueUserIds) {
    const result = await runDigestForUser(userId);
    results.push({ userId, digestId: result.digestId, error: result.error });

    if (result.notification && result.notification.totalEmails > 0) {
      const { data: settings } = await supabase
        .from("mailflow_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (settings) {
        if ((settings as Record<string, unknown>).telegram_chat_id) {
          await sendDigestTelegram(
            (settings as Record<string, unknown>).telegram_chat_id as string,
            result.notification
          ).catch(() => {});
        }
        if ((settings as Record<string, unknown>).slack_webhook_url) {
          await sendDigestSlack(
            (settings as Record<string, unknown>).slack_webhook_url as string,
            result.notification
          ).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ processed: uniqueUserIds.length, results });
}

export const maxDuration = 300;
