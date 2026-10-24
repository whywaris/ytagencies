// Free vs Pro listings (src/lib/entitlements.ts): owners edit the basics on Free; client details,
// booking, channels, unlimited case studies, analytics, the Pro badge and placement are Pro.
import assert from "node:assert/strict";
import { test } from "node:test";

import { entitlementsFor, isManaged, PAST_DUE_GRACE_DAYS } from "../src/lib/entitlements.ts";

const now = new Date("2026-10-07T12:00:00Z");
const day = 86_400_000;
const at = (ms) => new Date(now.getTime() + ms).toISOString();
const pro = (extra = {}) => ({
  plan_id: "pro",
  status: "active",
  starts_at: "2026-09-01T00:00:00Z",
  ends_at: null,
  ...extra,
});

test("no subscription: Free edits the basics but can't see lead contact details", () => {
  const e = entitlementsFor({ subscriptions: [], verificationApproved: false, now });
  assert.deepEqual(
    {
      managed: e.managed,
      plan: e.plan,
      canEdit: e.canEdit,
      leadDetails: e.leadDetails,
      responseTime: e.responseTime,
      showSimilarAgencies: e.showSimilarAgencies,
      caseStudies: e.caseStudies,
      analyticsDays: e.analyticsDays,
      bookingButtons: e.bookingButtons,
      channels: e.channels,
      proBadge: e.proBadge,
      canBuySponsored: e.canBuySponsored,
    },
    {
      managed: false,
      plan: "none",
      canEdit: true,
      leadDetails: false,
      responseTime: false,
      showSimilarAgencies: true,
      caseStudies: 3,
      analyticsDays: 0,
      bookingButtons: false,
      channels: false,
      proBadge: false,
      canBuySponsored: false,
    },
  );
});

test("active Pro: managed, with the Pro entitlements", () => {
  const e = entitlementsFor({ subscriptions: [pro()], verificationApproved: false, now });
  assert.equal(e.managed, true);
  assert.equal(e.plan, "pro");
  assert.equal(e.leadDetails, true);
  assert.equal(e.proBadge, true);
  assert.equal(e.bookingButtons, true);
  assert.equal(e.channels, true);
  assert.equal(e.responseTime, true);
  assert.equal(e.showSimilarAgencies, false);
  assert.equal(e.analyticsDays, 365);
  assert.equal(e.canEdit, true);
  assert.equal(e.canBuySponsored, true);
  assert.equal(e.caseStudies, Infinity);
});

test("cancelling at the period end: managed until ends_at, then not", () => {
  const cancelling = pro({ cancel_at_period_end: true, ends_at: at(5 * day) });
  assert.equal(isManaged([cancelling], now), true);
  assert.equal(isManaged([cancelling], new Date(at(5 * day + 1))), false);
});

test("past due: managed within the 7-day grace, unmanaged after", () => {
  const pastDue = (since) => pro({ status: "past_due", past_due_since: at(-since) });
  assert.equal(PAST_DUE_GRACE_DAYS, 7);
  assert.equal(isManaged([pastDue(1 * day)], now), true);
  assert.equal(isManaged([pastDue(7 * day - 1000)], now), true);
  assert.equal(isManaged([pastDue(7 * day)], now), false);
  assert.equal(isManaged([pro({ status: "past_due", past_due_since: null })], now), false);
});

test("ended, cancelled, expired or not started yet: unmanaged", () => {
  assert.equal(isManaged([pro({ ends_at: at(-1000) })], now), false);
  assert.equal(isManaged([pro({ status: "cancelled" })], now), false);
  assert.equal(isManaged([pro({ status: "expired" })], now), false);
  assert.equal(isManaged([pro({ starts_at: at(day) })], now), false);
});

test("only Pro counts: old plan ids never manage a listing", () => {
  assert.equal(isManaged([pro({ plan_id: "founding" })], now), false);
  assert.equal(isManaged([pro({ plan_id: "free" })], now), false);
});

test("a lapsed row alongside a live one: managed", () => {
  assert.equal(isManaged([pro({ status: "cancelled" }), pro({ ends_at: at(day) })], now), true);
});

test("Verified badge: earned by verification, managed or not", () => {
  assert.equal(
    entitlementsFor({ subscriptions: [], verificationApproved: true, now }).verifiedBadge,
    true,
  );
  assert.equal(
    entitlementsFor({ subscriptions: [pro()], verificationApproved: false, now }).verifiedBadge,
    false,
  );
});
