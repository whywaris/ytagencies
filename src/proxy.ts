import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicPathExists } from "@/lib/public-slugs";
import { privateGate, safeNext } from "@/lib/redirects";
import { isRemovedPath, removedPage } from "@/lib/removed-paths";
import type { Database } from "@/lib/supabase/types";

// 1. The old directory's pages → 410 Gone (lib/removed-paths.ts).
// 2. Unknown public slugs → full server-rendered 404 (see lib/public-slugs.ts for why).
// 3. Private routes: refresh the Supabase session and gate /admin (SECURITY.md).
//    That's the optimistic check; every page and server action re-checks on the server.

// Any path this resolves to matches no route, so Next serves the root not-found with status 404.
const NOT_FOUND_REWRITE = "/not-found/unknown/slug";
const PRIVATE = /^\/(admin|login|auth)(\/|$)/;

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isRemovedPath(path)) {
    return new NextResponse(removedPage(request.nextUrl.origin), {
      status: 410,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=86400",
        "x-robots-tag": "noindex",
      },
    });
  }
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
  if (gate.action === "login") {
    // Back to the same page after signing in, query included.
    const next = safeNext(path + request.nextUrl.search);
    const to = next ? `/login?next=${encodeURIComponent(next)}` : gate.to;
    return redirectKeepingCookies(request, response, to);
  }

  if (gate.action === "no-access") {
    // Signed in but not an admin: the same 404 as an unknown page.
    const denied = NextResponse.rewrite(new URL(NOT_FOUND_REWRITE, request.url), { status: 404 });
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
  matcher: [
    "/((?!_next/|og/guide|sitemaps/|api/|apple-icon|opengraph-image|.*\\.).*)",
    "/badge.svg",
    "/badge-verified.svg",
  ],
};
