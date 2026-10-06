// Post-login and access redirects. Plain functions with no imports, so the proxy, server code and
// tests (tests/redirects.test.mjs) share one implementation.

const ORIGIN = "http://internal.invalid";

/**
 * The path if `next` is a same-site path, else null. Parsing it as a URL catches the tricks a
 * prefix check misses: //evil.com, /\evil.com, /\t/evil.com, https://evil.com.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.length > 500) return null;
  let url: URL;
  try {
    url = new URL(next, ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== ORIGIN) return null;
  const path = url.pathname + url.search + url.hash;
  // Never bounce back into the sign-in flow itself.
  if (/^\/(login|auth)(\/|$|\?)/.test(path)) return null;
  return path;
}

/** /auth/callback, carrying ?next= only when it's safe (magic link emailRedirectTo, Google redirectTo). */
export function callbackUrl(next: string | null | undefined) {
  const path = safeNext(next);
  return path ? `/auth/callback?next=${encodeURIComponent(path)}` : "/auth/callback";
}

/** Where to go after signing in: a safe ?next=, else /admin for admins and /dashboard for everyone else. */
export function postLoginPath(next: string | null | undefined, isAdmin: boolean) {
  return safeNext(next) ?? (isAdmin ? "/admin" : "/dashboard");
}

export type Gate = { action: "next" } | { action: "login"; to: string } | { action: "no-access" };

/** The proxy's optimistic check for /dashboard and /admin. Pages and actions re-check on the server. */
export function privateGate(path: string, signedIn: boolean, isAdmin: boolean): Gate {
  const isAdminArea = path === "/admin" || path.startsWith("/admin/");
  const isDashboard = path === "/dashboard" || path.startsWith("/dashboard/");
  if ((isAdminArea || isDashboard) && !signedIn) {
    return { action: "login", to: `/login?next=${encodeURIComponent(path)}` };
  }
  if (isAdminArea && !isAdmin) return { action: "no-access" };
  return { action: "next" };
}
