// The agency pricing page at /pricing: the old URL redirects, the period toggle sets the checkout
// period, Pro's features come from the entitlements, and there are two plans: Free and Pro.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { proFeatures } from "../src/lib/entitlements.ts";
import { PRICING_REDIRECTS, PROPOSALS_REDIRECTS } from "../src/lib/moved-pages.ts";
import { checkoutHref, perMonth } from "../src/lib/pricing.ts";

test("/for-agencies/pricing and /for-agencies 301 to /pricing", () => {
  const by = Object.fromEntries(PRICING_REDIRECTS.map((r) => [r.source, r]));
  assert.equal(by["/for-agencies/pricing"].destination, "/pricing");
  assert.equal(by["/for-agencies/pricing"].statusCode, 301);
  assert.equal(by["/for-agencies"].destination, "/pricing");
  // Next keeps the query string on redirects unless the destination sets its own.
  assert.ok(PRICING_REDIRECTS.every((r) => !r.destination.includes("?")));
});

test("the period toggle drives the checkout period", () => {
  assert.equal(checkoutHref("monthly"), "/dashboard/billing/checkout?period=monthly");
  assert.equal(checkoutHref("yearly"), "/dashboard/billing/checkout?period=yearly");
  assert.equal(perMonth(279), "$23.25");
  assert.equal(perMonth(240), "$20");
});

test("Pro's features are the entitlements' list, in the model's order", () => {
  assert.deepEqual(proFeatures(), [
    "Contact form on your profile, inquiries to your inbox",
    "Project requests that fit your services",
    "No other agencies suggested on your profile",
    "Direct booking buttons (Calendly link and WhatsApp) on your profile",
    "Edit your profile any time: case studies, channels, prices",
    "Website link tagged so you can track visits",
    "12 months of profile analytics",
  ]);
  // Pro doesn't change the order (lib/ranking.ts), and nothing is guaranteed.
  assert.ok(!proFeatures().some((x) => /above|rank|guarantee/i.test(x)));
});

test("/pricing shows two plans (Free, Pro) and no Sponsored or $49", () => {
  const cards = readFileSync("src/components/pro-billing.tsx", "utf8");
  const page = readFileSync("src/app/(marketing)/pricing/page.tsx", "utf8");
  const plans = [...cards.matchAll(/aria-labelledby="(plan-[a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(plans, ["plan-listing", "plan-pro"]);
  for (const src of [cards, page]) {
    assert.doesNotMatch(src, /sponsor/i);
    assert.doesNotMatch(src, /\$\s?49\b/);
  }
});

test("/get-matched 301s to /request-proposals, keeping the query", () => {
  assert.deepEqual(PROPOSALS_REDIRECTS, [
    { source: "/get-matched", destination: "/request-proposals", statusCode: 301 },
  ]);
  const sitemap = readFileSync("src/lib/sitemap.ts", "utf8");
  assert.match(sitemap, /path: "\/request-proposals"/);
  assert.doesNotMatch(sitemap, /get-matched/);
});

/** Every source file under a directory. */
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|mdx?)$/.test(p) ? [p] : [];
  });
}

test('no "$49" (the old Sponsored price) anywhere in the site', () => {
  const hits = files("src").filter((p) =>
    /\$\s?49\b|SPONSORED_FROM_USD/.test(readFileSync(p, "utf8")),
  );
  assert.deepEqual(hits, []);
});
