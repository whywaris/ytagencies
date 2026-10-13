import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicPathExists } from "@/lib/public-slugs";
import { privateGate } from "@/lib/redirects";
import type { Database } from "@/lib/supabase/types";

// 1. Unknown public slugs → full server-rendered 404 (see lib/public-slugs.ts for why).
// 2. Private routes: refresh the Supabase session and gate /dashboard and /admin (SECURITY.md).
//    That's the optimistic check; every page and server action re-checks on the server.

// Any path this resolves to matches no route, so Next serves the root not-found with status 404.
const NOT_FOUND_REWRITE = "/not-found/unknown/slug";
const PRIVATE = /^\/(dashboard|admin|login|auth|claim)(\/|$)|^\/list-your-agency\/new$/;

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if ((await publicPathExists(path)) === false) {
    return NextResponse.rewrite(new URL(NOT_FOUND_REWRITE, request.url));
  }
  // Public pages stay cookie-free and cacheable: no session work.
  if (!PRIVATE.test(path)) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Cache-Control etc. so a response carrying a fresh session is never cached.
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // getUser() validates the token with Supabase Auth (getSession() would trust the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminArea = path === "/admin" || path.startsWith("/admin/");
  let isAdmin = false;
  if (isAdminArea && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = profile?.role === "admin";
  }

  const gate = privateGate(path, !!user, isAdmin);
  if (gate.action === "login") return redirectKeepingCookies(request, response, gate.to);
  if (gate.action === "no-access") {
    // Same URL, clear message (src/app/(marketing)/no-access) instead of a silent redirect.
    const denied = NextResponse.rewrite(new URL("/no-access", request.url), { status: 403 });
    response.cookies.getAll().forEach((c) => denied.cookies.set(c));
    denied.headers.set("X-Robots-Tag", "noindex, nofollow");
    return denied;
  }

  // Private pages: never indexed, never cached by shared caches.
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function redirectKeepingCookies(request: NextRequest, from: NextResponse, to: string) {
  const redirect = NextResponse.redirect(new URL(to, request.url));
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  redirect.headers.set("X-Robots-Tag", "noindex, nofollow");
  return redirect;
}

// Every page path. Static assets, files with an extension (icon.svg, logo.png, manifest…), icons,
// social images, sitemaps and robots skip the proxy entirely. No page slug contains a dot.
export const config = {
  matcher: ["/((?!_next/|og/|sitemaps/|api/|apple-icon|opengraph-image|.*\\.).*)"],
};
