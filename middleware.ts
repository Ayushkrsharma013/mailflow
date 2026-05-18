import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;

  const basePath = "/mailflow";
  let normalizedPath = path;
  if (normalizedPath.startsWith(basePath)) {
    normalizedPath = normalizedPath.slice(basePath.length) || "/";
  }

  const publicRoutes = ["/", "/login"];
  const isPublic = publicRoutes.some(r => normalizedPath === r || normalizedPath.startsWith(r + "/"));
  const isStatic = /\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|map)$/.test(path);
  const isApi = normalizedPath.startsWith("/api/");

  if (isPublic || isStatic || isApi) return res;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  const supabase = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return req.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/mailflow/login", req.url);
    loginUrl.searchParams.set("redirect", normalizedPath);
    return NextResponse.redirect(loginUrl);
  }

  // Onboarding redirect — redirect to onboarding if user hasn't completed it
  if (user && !isPublic && normalizedPath !== "/onboarding" && !isApi) {
    const supabaseAdmin = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });

    try {
      const { data: onboarding } = await supabaseAdmin
        .from("onboarding_progress")
        .select("completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!onboarding || !onboarding.completed) {
        return NextResponse.redirect(new URL("/mailflow/onboarding", req.url));
      }
    } catch {
      // If query fails (table might not exist yet), skip onboarding check
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/telegram|api/slack|api/cron).*)"],
};
