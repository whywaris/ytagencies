// The agency pricing page at /pricing: the old URL redirects, the period toggle sets the checkout
// period, Pro's features come from the entitlements, and there are two plans: Free and Pro.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { freeFeatures, proFeatures } from "../src/lib/entitlements.ts";
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

test("Pro's features are the entitlements' list, leading with client details", () => {
  assert.deepEqual(proFeatures(), [
    "See client details and reply to every request",
    "Unlimited case studies",
    "Pro badge, and shown before free listings in the directory",
    "No other agencies suggested on your profile",
    "Direct booking buttons (Calendly link and WhatsApp) on your profile",
    "YouTube channels you work on, with live stats",
    "12 months of profile analytics",
  ]);
  // Nothing is guaranteed, and nothing Free already has is sold again.
  assert.ok(!proFeatures().some((x) => /guarantee|leads per/i.test(x)));
  assert.ok(!proFeatures().some((x) => freeFeatures().includes(x)));
});

test("Free's features: editing, request previews and 3 case studies", () => {
  assert.deepEqual(freeFeatures(), [
    "Preview of every request sent to you (service, niche, budget, timeline)",
    "Edit logo, description, prices, services, industries and locations",
    "Up to 3 case studies",
  ]);
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
