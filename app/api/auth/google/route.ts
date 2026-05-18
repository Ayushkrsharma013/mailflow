import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGoogleOAuthUrl } from "@/lib/google-auth";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/mailflow/login?redirect=/mailflow/accounts", process.env.NEXT_PUBLIC_SITE_URL || ""));
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const redirectUri = `${siteUrl}/mailflow/api/auth/google/callback`;
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString("base64url");

  const url = getGoogleOAuthUrl(redirectUri, state);
  return NextResponse.redirect(url);
}
