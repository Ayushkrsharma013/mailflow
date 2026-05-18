import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGoogleOAuthUrl } from "@/lib/google-auth";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/mailflow/login?redirect=/accounts", process.env.NEXT_PUBLIC_SITE_URL || ""));
  }

  // Derive redirect URI from the incoming request so it works across
  // all domains (local dev, Vercel preview, custom domain). Falls back
  // to NEXT_PUBLIC_SITE_URL for environments where headers are unavailable.
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const siteUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || "");
  const redirectUri = `${siteUrl}/mailflow/api/auth/google/callback`;
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString("base64url");

  const url = getGoogleOAuthUrl(redirectUri, state);
  return NextResponse.redirect(url);
}
