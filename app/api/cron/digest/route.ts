import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runDigestForUser } from "@/lib/digest";
import { sendDigestTelegram, sendDigestSlack } from "@/lib/notify";

const SCHEDULE_HOURS: Record<string, number> = {
  morning: 7,
  afternoon: 12,
  evening: 18,
};

function getCurrentHourInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const hourStr = formatter.format(new Date());
    const hour = parseInt(hourStr, 10);
    return isNaN(hour) ? new Date().getUTCHours() : hour;
  } catch {
    return new Date().getUTCHours();
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  if (!expectedAuth || authHeader !== expectedAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: userIds, error } = await supabase
    .from("gmail_accounts")
    .select("user_id")
    .eq("is_active", true);

  if (error || !userIds) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const uniqueUserIds = [...new Set(userIds.map(r => r.user_id))];
  const results: { userId: string; digestId: string | null; skipped?: boolean; error?: string }[] = [];

  for (const userId of uniqueUserIds) {
    const { data: settings } = await supabase
      .from("mailflow_settings")
      .select("timezone, digest_schedule")
      .eq("user_id", userId)
      .maybeSingle();

    const tz = (settings as { timezone?: string } | null)?.timezone || "UTC";
    const schedule = (settings as { digest_schedule?: string[] } | null)?.digest_schedule || ["morning", "afternoon", "evening"];
    const localHour = getCurrentHourInTimezone(tz);
    const shouldRun = schedule.some((slot: string) => SCHEDULE_HOURS[slot] === localHour);

    if (!shouldRun) {
      results.push({ userId, digestId: null, skipped: true });
      continue;
    }

    const result = await runDigestForUser(userId);
    results.push({ userId, digestId: result.digestId, error: result.error });

    if (result.notification && result.notification.totalEmails > 0) {
      const { data: fullSettings } = await supabase
        .from("mailflow_settings")
        .select("telegram_chat_id, slack_webhook_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (fullSettings) {
        const s = fullSettings as Record<string, unknown>;
        if (s.telegram_chat_id) {
          await sendDigestTelegram(s.telegram_chat_id as string, result.notification).catch(() => {});
        }
        if (s.slack_webhook_url) {
          await sendDigestSlack(s.slack_webhook_url as string, result.notification).catch(() => {});
        }
      }
    }
  }

  const ran = results.filter(r => !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  return NextResponse.json({ processed: ran, skipped, results });
}

export const maxDuration = 300;
