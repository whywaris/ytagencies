// The agency pricing page at /pricing: the old URL redirects, the period toggle sets the checkout
// period, Pro's features come from the entitlements, and Sponsored has no public price.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { proFeatures } from "../src/lib/entitlements.ts";
import { PRICING_REDIRECTS } from "../src/lib/pricing-redirects.ts";
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
  assert.equal(checkoutHref("monthly"), "/dashboard/billing?interval=month");
  assert.equal(checkoutHref("yearly"), "/dashboard/billing?interval=year");
  assert.equal(perMonth(279), "$23.25");
  assert.equal(perMonth(240), "$20");
});

test("Pro's features are the entitlements' list", () => {
  const f = proFeatures();
  assert.ok(f.includes("A contact form on your profile: inquiries go straight to you"));
  assert.ok(
    f.includes("Your profile can be contacted. Free listings send visitors to other agencies."),
  );
  // Pro doesn't change the order (lib/ranking.ts).
  assert.ok(!f.some((x) => /above unmanaged|rank/i.test(x)));
  assert.ok(f.includes("No other agencies suggested on your profile"));
  assert.ok(f.includes("12 months of profile analytics"));
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
