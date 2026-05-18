import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google-auth";
import { encryptToken } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/mailflow/accounts?error=oauth_denied", req.url));
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const redirectUri = `${siteUrl}/mailflow/api/auth/google/callback`;

  try {
    const result = await exchangeCodeForTokens(code, redirectUri);
    if (result.error || !result.tokens?.refresh_token) {
      return NextResponse.redirect(new URL("/mailflow/accounts?error=token_exchange_failed", req.url));
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/mailflow/login", req.url));
    }

    const profileRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${result.tokens.access_token}` },
    });
    const profile = (await profileRes.json()) as { emailAddress?: string };
    const email = profile.emailAddress || "unknown@gmail.com";

    const encryptedRefresh = await encryptToken(result.tokens.refresh_token);
    const encryptedAccess = await encryptToken(result.tokens.access_token);
    const expiresAt = new Date(Date.now() + result.tokens.expires_in * 1000).toISOString();

    await supabase.from("gmail_accounts").upsert({
      user_id: user.id,
      email,
      google_refresh_token: encryptedRefresh,
      google_access_token: encryptedAccess,
      token_expires_at: expiresAt,
      is_active: true,
    }, { onConflict: "user_id, email" });

    return NextResponse.redirect(new URL("/mailflow/accounts?success=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/mailflow/accounts?error=unexpected", req.url));
  }
}
