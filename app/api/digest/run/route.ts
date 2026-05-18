import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runDigestForUser } from "@/lib/digest";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: recent } = await supabase
    .from("digests")
    .select("created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const elapsed = Date.now() - new Date(recent.created_at).getTime();
    if (elapsed < 5 * 60 * 1000) {
      const waitSeconds = Math.ceil((5 * 60 * 1000 - elapsed) / 1000);
      return NextResponse.json({ error: `Rate limited. Try again in ${waitSeconds}s` }, { status: 429 });
    }
  }

  try {
    const result = await runDigestForUser(user.id);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
