// Post-login and access redirect rules (src/lib/redirects.ts). Run with `pnpm test`.
// Node strips the TypeScript types itself, so this imports the real source file.
import assert from "node:assert/strict";
import { test } from "node:test";

import { callbackUrl, postLoginPath, privateGate, safeNext } from "../src/lib/redirects.ts";

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

test("callbackUrl carries next through the magic link and Google only when safe", () => {
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
