// Plan entitlements (src/lib/entitlements.ts, ADMIN_V2_SPEC §6).
import assert from "node:assert/strict";
import { test } from "node:test";

import { currentPlan, entitlementsFor } from "../src/lib/entitlements.ts";

const now = new Date("2026-10-07T12:00:00Z");
const sub = (plan_id, extra = {}) => ({
  plan_id,
  status: "active",
  starts_at: "2026-09-01T00:00:00Z",
  ends_at: null,
  ...extra,
});

test("no subscription means Free", () => {
  const e = entitlementsFor({ subscriptions: [], verificationApproved: false, now });
  assert.equal(e.plan, "free");
  assert.equal(e.caseStudies, 2);
  assert.equal(e.websiteLink, false);
  assert.equal(e.showSimilarAgencies, true);
  assert.equal(e.matchPriority, "normal");
  assert.equal(e.listTier, "free");
  assert.equal(e.analyticsDays, 30);
  assert.equal(e.utmLinks, false);
  assert.equal(e.canBuySponsored, false);
  assert.equal(e.verifiedBadge, false);
  assert.equal(e.foundingBadge, false);
});

test("Verified plan unlocks the paid entitlements", () => {
  const e = entitlementsFor({ subscriptions: [sub("pro")], verificationApproved: false, now });
  assert.equal(e.plan, "pro");
  assert.equal(e.caseStudies, Infinity);
  assert.equal(e.websiteLink, true);
  assert.equal(e.showSimilarAgencies, false);
  assert.equal(e.matchPriority, "high");
  assert.equal(e.listTier, "paid");
  assert.equal(e.analyticsDays, 365);
  assert.equal(e.utmLinks, true);
  assert.equal(e.canBuySponsored, true);
  // Paying doesn't buy the badge: it needs an approved verification.
  assert.equal(e.verifiedBadge, false);
});

test("the badge comes from verification on any plan, including Free", () => {
  assert.equal(
    entitlementsFor({ subscriptions: [], verificationApproved: true, now }).verifiedBadge,
    true,
  );
});

test("Founding: Verified-level while it lasts, badge forever, Free after", () => {
  const during = entitlementsFor({
    subscriptions: [sub("founding", { ends_at: "2027-03-01T00:00:00Z" })],
    verificationApproved: false,
    now,
  });
  assert.equal(during.plan, "founding");
  assert.equal(during.listTier, "paid");
  assert.equal(during.foundingBadge, true);

  const after = entitlementsFor({
    subscriptions: [sub("founding", { status: "expired", ends_at: "2026-10-01T00:00:00Z" })],
    verificationApproved: false,
    now,
  });
  assert.equal(after.plan, "free");
  assert.equal(after.caseStudies, 2);
  assert.equal(after.foundingBadge, true);
});

test("currentPlan ignores rows that are cancelled, expired, ended or not started", () => {
  assert.equal(currentPlan([sub("pro", { status: "cancelled" })], now), "free");
  assert.equal(currentPlan([sub("pro", { ends_at: "2026-10-07T11:59:59Z" })], now), "free");
  assert.equal(currentPlan([sub("pro", { starts_at: "2026-11-01T00:00:00Z" })], now), "free");
  assert.equal(currentPlan([sub("gold")], now), "free");
  assert.equal(currentPlan([sub("pro", { ends_at: "2026-10-07T12:00:01Z" })], now), "pro");
});
