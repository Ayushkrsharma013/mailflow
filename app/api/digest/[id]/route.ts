import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: digest } = await supabase
    .from("digests")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!digest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: emails } = await supabase
    .from("digest_emails")
    .select("*")
    .eq("digest_id", id)
    .order("created_at", { ascending: false });

  const emailIds = (emails || []).map(e => e.id);
  const { data: actions } = emailIds.length > 0
    ? await supabase.from("mailflow_actions").select("*").in("digest_email_id", emailIds).order("created_at", { ascending: false })
    : { data: [] };

  return NextResponse.json({ digest, emails: emails || [], actions: actions || [] });
}
