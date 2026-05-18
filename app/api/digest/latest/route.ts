import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: digest } = await supabase
    .from("digests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!digest) return NextResponse.json({ digest: null, emails: [], actions: [] });

  const { data: emails } = await supabase
    .from("digest_emails")
    .select("*")
    .eq("digest_id", digest.id)
    .order("created_at", { ascending: false });

  const emailIds = (emails || []).map(e => e.id);
  const { data: actions } = emailIds.length > 0
    ? await supabase.from("mailflow_actions").select("*").in("digest_email_id", emailIds).order("created_at", { ascending: false })
    : { data: [] };

  return NextResponse.json({ digest, emails: emails || [], actions: actions || [] });
}
