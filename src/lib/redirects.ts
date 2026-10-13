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

/**
 * The origin the magic link's emailRedirectTo is built on: the
 * request's own origin when it's the site itself or a local dev server (so localhost:3001 comes
 * back to 3001), else SITE_URL. A spoofed Host can't steer it anywhere else, and Supabase only
 * accepts redirect URLs on its allowlist anyway.
 */
export function authOrigin(requestOrigin: string | null | undefined, siteUrl: string) {
  const site = new URL(siteUrl).origin;
  if (!requestOrigin) return site;
  let url: URL;
  try {
    url = new URL(requestOrigin);
  } catch {
    return site;
  }
  if (url.origin === site) return site;
  const local = url.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
  return local ? url.origin : site;
}

/** Where to go after signing in: a safe ?next=, else /admin for admins and /dashboard for everyone else. */
export function postLoginPath(next: string | null | undefined, isAdmin: boolean) {
  return safeNext(next) ?? (isAdmin ? "/admin" : "/dashboard");
}

/**
 * `next` from an email link's `next` param. The Supabase template passes {{ .RedirectTo }}: the
 * full emailRedirectTo (https://ytagencies.com/auth/callback?next=%2Fadmin, not URL-encoded), a
 * plain path, or the Site URL when Supabase dropped an unlisted redirect. Only our own origins
 * count, the callback's own ?next= is unwrapped, and the bare home page means "no next".
 */
export function nextFromRedirectTo(raw: string | null | undefined, origins: string[]) {
  if (!raw || raw.length > 1000) return null;
  if (!raw.startsWith("/") && !/^https?:\/\//i.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== ORIGIN && !origins.includes(url.origin)) return null;
  if (url.pathname === "/auth/callback") return safeNext(url.searchParams.get("next"));
  const path = url.pathname + url.search + url.hash;
  return path === "/" ? null : safeNext(path);
}

/** Email link types /auth/confirm accepts: magic link and sign-up confirmation. */
const EMAIL_LINK_TYPES = new Set(["email", "magiclink", "signup"]);

export type EmailLinkDeps = {
  /** supabase.auth.verifyOtp({ token_hash, type }); errorCode is Supabase's error code, if any. */
  verifyOtp(
    tokenHash: string,
    type: string,
  ): Promise<{ userId: string; errorCode?: never } | { userId?: never; errorCode: string }>;
  isAdmin(userId: string): Promise<boolean>;
};

/**
 * /auth/confirm (token_hash flow): works in any browser, unlike PKCE links that need the code
 * verifier cookie from the browser that asked. Returns where to redirect.
 */
export async function confirmEmailLink(
  params: { tokenHash: string | null; type: string | null; next: string | null },
  origins: string[],
  deps: EmailLinkDeps,
) {
  const next = nextFromRedirectTo(params.next, origins);
  const fail = (error: "expired" | "link") =>
    `/login?error=${error}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  const { tokenHash, type } = params;
  if (!tokenHash || tokenHash.length > 200 || !type || !EMAIL_LINK_TYPES.has(type)) {
    return fail("link");
  }
  const result = await deps.verifyOtp(tokenHash, type);
  if (result.errorCode !== undefined) {
    return fail(result.errorCode === "otp_expired" ? "expired" : "link");
  }
  return postLoginPath(next, next ? false : await deps.isAdmin(result.userId));
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

/**
 * Where an old /dashboard/<agency id><rest> link goes: /dashboard/<slug><rest>, with sections that
 * were renamed since (leads → inquiries, plan → analytics).
 */
export function newDashboardPath(slug: string, rest: string) {
  const section = rest
    .replace(/^\/leads(?=\/|$)/, "/inquiries")
    .replace(/^\/plan(?=\/|$)/, "/analytics");
  return `/dashboard/${slug}${section}`;
}
