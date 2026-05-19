import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google-auth";
import { encryptToken } from "@/lib/crypto";
import { runDigestForUser } from "@/lib/digest";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/mailflow/accounts?error=oauth_denied", process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin));
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const siteUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || "");
  const redirectUri = `${siteUrl}/mailflow/api/auth/google/callback`;

  try {
    const result = await exchangeCodeForTokens(code, redirectUri);
    if (result.error || !result.tokens?.refresh_token) {
      return NextResponse.redirect(new URL("/mailflow/accounts?error=token_exchange_failed", process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin));
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/mailflow/login", process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin));
    }

    const profileRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${result.tokens.access_token}` },
    });
    const profileData = (await profileRes.json()) as Record<string, unknown>;
    console.log("[OAuth callback] Gmail profile response:", JSON.stringify(profileData));
    if (!profileRes.ok) {
      return NextResponse.redirect(new URL("/mailflow/accounts?error=profile_fetch_failed", process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin));
    }
    const email = (profileData.emailAddress as string) || "unknown@gmail.com";

    const encryptedRefresh = await encryptToken(result.tokens.refresh_token);
    const encryptedAccess = await encryptToken(result.tokens.access_token);
    const expiresAt = new Date(Date.now() + result.tokens.expires_in * 1000).toISOString();

    // Upsert Gmail account — check for existing row first since there's
    // no unique constraint on (user_id, email) for the upsert onConflict clause.
    const { data: existingAccount } = await supabase
      .from("gmail_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("email", email)
      .maybeSingle();

    const accountPayload = {
      user_id: user.id,
      email,
      google_refresh_token: encryptedRefresh,
      google_access_token: encryptedAccess,
      token_expires_at: expiresAt,
      is_active: true,
    };

    if (existingAccount) {
      await supabase
        .from("gmail_accounts")
        .update(accountPayload)
        .eq("id", existingAccount.id);
    } else {
      await supabase
        .from("gmail_accounts")
        .insert(accountPayload);
    }

    // Kick off first digest in background — don't block the redirect
    runDigestForUser(user.id).catch((err) => {
      console.error("[OAuth callback] First digest error:", err);
    });

    // Update onboarding progress — mark Gmail connection step complete
    const { data: existingProgress } = await supabase
      .from("onboarding_progress")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingProgress) {
      await supabase
        .from("onboarding_progress")
        .update({ current_step: 3 })
        .eq("id", existingProgress.id);
    } else {
      await supabase
        .from("onboarding_progress")
        .insert({ user_id: user.id, current_step: 3, completed: false });
    }

    // Redirect back to onboarding so user continues from step 3 (Channels)
    return NextResponse.redirect(new URL("/mailflow/onboarding", process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin));
  } catch {
    return NextResponse.redirect(new URL("/mailflow/accounts?error=unexpected", process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin));
  }
}
