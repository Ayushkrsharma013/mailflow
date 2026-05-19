import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { registerGmailWatch } from "@/lib/gmail";
import type { GmailAccount } from "@/lib/types";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: accounts, error } = await supabase
    .from("gmail_accounts")
    .select("*")
    .eq("is_active", true)
    .or(`watch_expiry.is.null,watch_expiry.lte.${in24Hours}`);

  if (error || !accounts?.length) {
    return NextResponse.json({ renewed: 0, total: 0 });
  }

  let renewed = 0;
  for (const account of accounts as unknown as GmailAccount[]) {
    const ok = await registerGmailWatch(account);
    if (ok) renewed++;
  }

  return NextResponse.json({ renewed, total: accounts.length });
}

export const maxDuration = 60;
