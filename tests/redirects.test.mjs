// Post-login and access redirect rules (src/lib/redirects.ts). Run with `pnpm test`.
// Node strips the TypeScript types itself, so this imports the real source file.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  authOrigin,
  callbackUrl,
  confirmEmailLink,
  newDashboardPath,
  nextFromRedirectTo,
  postLoginPath,
  privateGate,
  safeNext,
} from "../src/lib/redirects.ts";

test("safeNext keeps same-site paths, with their query and hash", () => {
  assert.equal(safeNext("/dashboard"), "/dashboard");
  assert.equal(safeNext("/admin/claims"), "/admin/claims");
  assert.equal(safeNext("/agency/acme/claim"), "/agency/acme/claim");
  assert.equal(safeNext("/list-your-agency/new?x=1#top"), "/list-your-agency/new?x=1#top");
});

test("safeNext rejects anything that could leave the site", () => {
  for (const evil of [
    "https://evil.com",
    "//evil.com",
    String.raw`/\evil.com`,
    "/\t/evil.com",
    String.raw`\\evil.com`,
    "javascript:alert(1)",
    "evil.com",
    "",
    null,
    undefined,
    "/" + "a".repeat(600),
  ]) {
    assert.equal(safeNext(evil), null, String(evil));
  }
});

test("safeNext never loops back into the sign-in flow", () => {
  assert.equal(safeNext("/login"), null);
  assert.equal(safeNext("/login?next=/admin"), null);
  assert.equal(safeNext("/auth/callback"), null);
  assert.equal(safeNext("/loginx"), "/loginx");
});

test("postLoginPath: a safe next wins, otherwise admins → /admin, everyone else → /dashboard", () => {
  assert.equal(postLoginPath("/agency/acme/claim", false), "/agency/acme/claim");
  assert.equal(postLoginPath("/dashboard", true), "/dashboard");
  assert.equal(postLoginPath(null, true), "/admin");
  assert.equal(postLoginPath(null, false), "/dashboard");
  assert.equal(postLoginPath("//evil.com", true), "/admin");
  assert.equal(postLoginPath("https://evil.com", false), "/dashboard");
});

test("callbackUrl carries next through the magic link only when safe", () => {
  assert.equal(callbackUrl("/admin/claims"), "/auth/callback?next=%2Fadmin%2Fclaims");
  assert.equal(
    callbackUrl("/list-your-agency/new"),
    "/auth/callback?next=%2Flist-your-agency%2Fnew",
  );
  assert.equal(callbackUrl(null), "/auth/callback");
  assert.equal(callbackUrl("//evil.com"), "/auth/callback");
});

test("privateGate: signed-out visitors go to login with next", () => {
  assert.deepEqual(privateGate("/dashboard", false, false), {
    action: "login",
    to: "/login?next=%2Fdashboard",
  });
  assert.deepEqual(privateGate("/admin/claims", false, false), {
    action: "login",
    to: "/login?next=%2Fadmin%2Fclaims",
  });
});

test("privateGate: signed-in non-admins see 'no access' on /admin, not a redirect", () => {
  assert.deepEqual(privateGate("/admin", true, false), { action: "no-access" });
  assert.deepEqual(privateGate("/admin/agencies/x", true, false), { action: "no-access" });
  assert.deepEqual(privateGate("/admin", true, true), { action: "next" });
  assert.deepEqual(privateGate("/dashboard/x", true, false), { action: "next" });
  // Paths that only start with the same letters aren't the admin area.
  assert.deepEqual(privateGate("/administrator", true, false), { action: "next" });
});

// /auth/confirm (token_hash email links)
const SITE = "https://ytagencies.com";
const ORIGINS = [SITE];
const fakeDeps = ({ errorCode, admin = false } = {}) => {
  const calls = [];
  return {
    calls,
    async verifyOtp(tokenHash, type) {
      calls.push([tokenHash, type]);
      return errorCode ? { errorCode } : { userId: "u1" };
    },
    async isAdmin() {
      return admin;
    },
  };
};

test("nextFromRedirectTo unwraps the template's {{ .RedirectTo }}", () => {
  // The raw callback URL as the template inserts it (the outer query already decoded once).
  assert.equal(
    nextFromRedirectTo(`${SITE}/auth/callback?next=/admin/claims`, ORIGINS),
    "/admin/claims",
  );
  assert.equal(
    nextFromRedirectTo(`${SITE}/auth/callback?next=%2Fdashboard`, ORIGINS),
    "/dashboard",
  );
  assert.equal(nextFromRedirectTo(`${SITE}/auth/callback`, ORIGINS), null);
  assert.equal(nextFromRedirectTo(SITE, ORIGINS), null); // Site URL fallback
  assert.equal(nextFromRedirectTo(`${SITE}/agency/acme/claim`, ORIGINS), "/agency/acme/claim");
  assert.equal(nextFromRedirectTo("/dashboard", ORIGINS), "/dashboard");
});

test("nextFromRedirectTo refuses other sites and tricks", () => {
  for (const evil of [
    "https://evil.com/dashboard",
    "https://evil.com/auth/callback?next=/admin",
    `${SITE}/auth/callback?next=https://evil.com`,
    `${SITE}/auth/callback?next=//evil.com`,
    "//evil.com/dashboard",
    "javascript:alert(1)",
    `${SITE}.evil.com/dashboard`,
    "",
    null,
  ]) {
    assert.equal(nextFromRedirectTo(evil, ORIGINS), null, String(evil));
  }
});

test("confirmEmailLink: a valid link signs in and goes to next", async () => {
  const deps = fakeDeps();
  const to = await confirmEmailLink(
    { tokenHash: "abc", type: "email", next: `${SITE}/auth/callback?next=/admin/claims` },
    ORIGINS,
    deps,
  );
  assert.equal(to, "/admin/claims");
  assert.deepEqual(deps.calls, [["abc", "email"]]);
});

test("confirmEmailLink: without next, admins land on /admin and others on /dashboard", async () => {
  const link = { tokenHash: "abc", type: "email", next: `${SITE}/auth/callback` };
  assert.equal(await confirmEmailLink(link, ORIGINS, fakeDeps({ admin: true })), "/admin");
  assert.equal(await confirmEmailLink(link, ORIGINS, fakeDeps()), "/dashboard");
});

test("confirmEmailLink: an expired or used link gets its own message, keeping next", async () => {
  const to = await confirmEmailLink(
    { tokenHash: "abc", type: "email", next: `${SITE}/auth/callback?next=/admin` },
    ORIGINS,
    fakeDeps({ errorCode: "otp_expired" }),
  );
  assert.equal(to, "/login?error=expired&next=%2Fadmin");
});

test("confirmEmailLink: other failures get the generic message", async () => {
  const deps = fakeDeps({ errorCode: "unexpected_failure" });
  assert.equal(
    await confirmEmailLink({ tokenHash: "abc", type: "email", next: null }, ORIGINS, deps),
    "/login?error=link",
  );
  // Missing token or an unsupported type never reaches Supabase.
  const unused = fakeDeps();
  for (const params of [
    { tokenHash: null, type: "email", next: null },
    { tokenHash: "abc", type: "recovery", next: null },
    { tokenHash: "abc", type: null, next: null },
  ]) {
    assert.equal(await confirmEmailLink(params, ORIGINS, unused), "/login?error=link");
  }
  assert.equal(unused.calls.length, 0);
});

test("confirmEmailLink: an unsafe next is dropped, not followed", async () => {
  for (const next of [
    "https://evil.com/steal",
    "//evil.com",
    `${SITE}/auth/callback?next=https://evil.com`,
  ]) {
    assert.equal(
      await confirmEmailLink({ tokenHash: "abc", type: "email", next }, ORIGINS, fakeDeps()),
      "/dashboard",
      next,
    );
    assert.equal(
      await confirmEmailLink(
        { tokenHash: "abc", type: "email", next },
        ORIGINS,
        fakeDeps({ errorCode: "otp_expired" }),
      ),
      "/login?error=expired",
      next,
    );
  }
});

test("authOrigin keeps local dev ports and the site, else falls back to SITE_URL", () => {
  const dev = "http://localhost:3000";
  assert.equal(authOrigin("http://localhost:3001", dev), "http://localhost:3001");
  assert.equal(authOrigin("http://localhost:3000", dev), "http://localhost:3000");
  assert.equal(authOrigin("http://127.0.0.1:3001", dev), "http://127.0.0.1:3001");
  assert.equal(authOrigin(null, dev), dev);
  const prod = "https://ytagencies.com";
  assert.equal(authOrigin("https://ytagencies.com", prod), prod);
  for (const spoofed of [
    "https://evil.com",
    "http://evil.com",
    "https://localhost.evil.com",
    "https://www.ytagencies.com",
    "not a url",
    "",
  ]) {
    assert.equal(authOrigin(spoofed, prod), prod, spoofed);
  }
});

test("old /dashboard/<id> links map to /dashboard/<slug>, renamed sections included", () => {
  assert.equal(newDashboardPath("goat-agency", ""), "/dashboard/goat-agency");
  assert.equal(newDashboardPath("goat-agency", "/billing"), "/dashboard/goat-agency/billing");
  assert.equal(newDashboardPath("goat-agency", "/leads"), "/dashboard/goat-agency/inquiries");
  assert.equal(newDashboardPath("goat-agency", "/plan"), "/dashboard/goat-agency/analytics");
  // Only whole segments are renamed.
  assert.equal(newDashboardPath("goat-agency", "/leadsx"), "/dashboard/goat-agency/leadsx");
});
