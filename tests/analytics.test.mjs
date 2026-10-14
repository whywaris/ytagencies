// When Google Analytics may load (src/lib/analytics.ts, src/lib/track.ts) and whether the site
// may be indexed (src/lib/indexing.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { gaId } from "../src/lib/analytics.ts";
import { indexingAllowed, noindexHeaders, robotsRules } from "../src/lib/indexing.ts";
import { hasSession, shouldLoadGa } from "../src/lib/track.ts";

const ID = "G-E6X061VCPX";
const SESSION = "sb-lkpmdqybxkhirlsqhffs-auth-token";

test("GA: only with an ID on Vercel production, whatever ALLOW_INDEXING says", () => {
  assert.equal(gaId({ NEXT_PUBLIC_GA_ID: ID, VERCEL_ENV: "production" }), ID);
  assert.equal(
    gaId({ NEXT_PUBLIC_GA_ID: ID, VERCEL_ENV: "production", ALLOW_INDEXING: "false" }),
    ID,
  );
  assert.equal(
    gaId({ NEXT_PUBLIC_GA_ID: ID, VERCEL_ENV: "preview", ALLOW_INDEXING: "true" }),
    null,
  );
  assert.equal(gaId({ NEXT_PUBLIC_GA_ID: ID }), null); // localhost
  assert.equal(gaId({ VERCEL_ENV: "production" }), null);
});

test("GA: rejects anything that isn't a GA4 measurement ID", () => {
  assert.equal(gaId({ NEXT_PUBLIC_GA_ID: "UA-1234-1", VERCEL_ENV: "production" }), null);
  assert.equal(gaId({ NEXT_PUBLIC_GA_ID: "G-x');alert(1)//", VERCEL_ENV: "production" }), null);
});

test("GA: signed in = no GA, on any page", () => {
  for (const cookie of [
    `${SESSION}=base64-abc`,
    `theme=dark; ${SESSION}.0=base64-abc; ${SESSION}.1=def`,
  ]) {
    assert.equal(hasSession(cookie), true, cookie);
    assert.equal(shouldLoadGa({ pathname: "/", cookie }), false, cookie);
    assert.equal(shouldLoadGa({ pathname: "/youtube-ads-agencies", cookie }), false, cookie);
  }
});

test("GA: signed out on a public page = GA may load", () => {
  assert.equal(shouldLoadGa({ pathname: "/", cookie: "" }), true);
  assert.equal(shouldLoadGa({ pathname: "/agency/goat-agency", cookie: "_ga=GA1.1.1" }), true);
  // The sign-in flow's code verifier alone isn't a session.
  assert.equal(hasSession(`${SESSION}-code-verifier=x`), false);
});

test("GA: never on private routes, signed in or not", () => {
  for (const pathname of [
    "/admin",
    "/dashboard/x",
    "/login",
    "/claim/goat-agency",
    "/auth/callback",
  ])
    assert.equal(shouldLoadGa({ pathname, cookie: "" }), false, pathname);
  assert.equal(shouldLoadGa({ pathname: "/claims-guide", cookie: "" }), true);
});

test("indexing: off unless ALLOW_INDEXING is exactly true", () => {
  assert.equal(indexingAllowed({ ALLOW_INDEXING: "true" }), true);
  for (const v of [undefined, "", "1", "TRUE", "false"])
    assert.equal(indexingAllowed({ ALLOW_INDEXING: v }), false, String(v));
});

test("indexing off: every response says noindex; on: no extra header", () => {
  assert.deepEqual(noindexHeaders(false), [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]);
  assert.deepEqual(noindexHeaders(true), []);
});

test("robots.txt: blocks everything with no sitemap until launch, normal rules after", () => {
  const sitemap = "https://ytagencies.com/sitemap.xml";
  const off = robotsRules(false, sitemap);
  assert.deepEqual(off, { rules: { userAgent: "*", disallow: "/" } });
  assert.equal("sitemap" in off, false);

  const on = robotsRules(true, sitemap);
  assert.equal(on.sitemap, sitemap);
  const [everyone, ai] = on.rules;
  assert.equal(everyone.userAgent, "*");
  assert.ok(everyone.allow.includes("/"));
  for (const path of ["/dashboard", "/admin", "/api", "/auth", "/login", "/claim", "/*?"])
    assert.ok(everyone.disallow.includes(path), path);
  // AI crawlers named and allowed, with the same private paths kept out.
  for (const bot of [
    "GPTBot",
    "OAI-SearchBot",
    "ClaudeBot",
    "PerplexityBot",
    "Google-Extended",
    "Applebot-Extended",
  ])
    assert.ok(ai.userAgent.includes(bot), bot);
  assert.deepEqual(ai.disallow, everyone.disallow);
  assert.deepEqual(ai.allow, everyone.allow);
});

test("gaId ignores spaces and newlines around a pasted ID", () => {
  assert.equal(
    gaId({ NEXT_PUBLIC_GA_ID: " G-ABC123XYZ\n", VERCEL_ENV: "production" }),
    "G-ABC123XYZ",
  );
  assert.equal(gaId({ NEXT_PUBLIC_GA_ID: "123456789", VERCEL_ENV: "production" }), null);
});
