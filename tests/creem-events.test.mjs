// Creem webhooks (src/lib/billing/creem-events.ts) and what they do to entitlements.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  changeFor,
  nextRow,
  parseCreemEvent,
  verifyCreemSignature,
} from "../src/lib/billing/creem-events.ts";
import { entitlementsFor } from "../src/lib/entitlements.ts";

const SECRET = "whsec_test";
const PRODUCTS = { monthly: "prod_month", yearly: "prod_year" };
const AGENCY = "00000000-0000-4000-8000-0000000000aa";
const T0 = Date.parse("2026-10-13T10:00:00Z");
const DAY = 86_400_000;

const sign = (body, secret = SECRET) => createHmac("sha256", secret).update(body).digest("hex");

const sub = (extra = {}) => ({
  id: "sub_1",
  object: "subscription",
  product: { id: "prod_month", billing_period: "every-month" },
  customer: { id: "cust_1", email: "owner@acme.test" },
  status: "active",
  current_period_end_date: new Date(T0 + 30 * DAY).toISOString(),
  metadata: { agency_id: AGENCY, user_id: "u1", interval: "month" },
  ...extra,
});
const event = (eventType, object, at = T0, id = `evt_${eventType}_${at}`) => ({
  id,
  eventType,
  created_at: at,
  object,
});

/** Applies events in order, like the webhook does (row per Creem subscription). */
function run(events) {
  let row = null;
  const emails = [];
  for (const e of events) {
    const change = changeFor(e, PRODUCTS);
    if (!change) continue;
    const next = nextRow(row, change, new Date(e.created_at));
    if (!next) continue;
    row = next.row;
    if (next.email) emails.push(next.email);
  }
  return { row, emails };
}
const asSubscription = (row) => ({ plan_id: "pro", ...row });
const managedAt = (row, at) =>
  entitlementsFor({
    subscriptions: row ? [asSubscription(row)] : [],
    verificationApproved: false,
    now: new Date(at),
  }).managed;

test("signature: valid, invalid, tampered, missing", () => {
  const body = JSON.stringify(event("subscription.paid", sub()));
  assert.equal(verifyCreemSignature(body, sign(body), SECRET), true);
  assert.equal(verifyCreemSignature(body, sign(body, "other"), SECRET), false);
  assert.equal(verifyCreemSignature(body.replace("sub_1", "sub_2"), sign(body), SECRET), false);
  assert.equal(verifyCreemSignature(body, null, SECRET), false);
  assert.equal(verifyCreemSignature(body, "abc", SECRET), false);
  assert.equal(verifyCreemSignature(body, sign(body), ""), false);
});

test("parse: rejects malformed events", () => {
  assert.equal(parseCreemEvent("not json"), null);
  assert.equal(parseCreemEvent(JSON.stringify({ id: "e", eventType: "x" })), null);
  const ok = parseCreemEvent(JSON.stringify(event("subscription.paid", sub())));
  assert.equal(ok.eventType, "subscription.paid");
});

test("checkout.completed: Pro starts, with agency, customer and interval; welcome email", () => {
  const { row, emails } = run([
    event("checkout.completed", {
      id: "ch_1",
      subscription: { id: "sub_1", status: "active", metadata: {} },
      customer: { id: "cust_1" },
      product: "prod_year",
      metadata: { agency_id: AGENCY, interval: "year" },
    }),
  ]);
  const change = changeFor(
    event("checkout.completed", {
      subscription: { id: "sub_1" },
      metadata: { agency_id: AGENCY.toUpperCase() },
    }),
    PRODUCTS,
  );
  assert.equal(change.agencyId, AGENCY);
  assert.equal(row.status, "active");
  assert.equal(row.customer_id, "cust_1");
  assert.equal(row.billing_interval, "year");
  assert.deepEqual(emails, ["welcome"]);
  assert.equal(managedAt(row, T0 + 1000), true);
});

test("active and paid: one welcome email, renewals extend the period", () => {
  const renewEnd = new Date(T0 + 60 * DAY).toISOString();
  const { row, emails } = run([
    event("checkout.completed", { subscription: sub(), metadata: sub().metadata }),
    event("subscription.active", sub(), T0 + 1000),
    event("subscription.paid", sub(), T0 + 2000),
    event("subscription.paid", sub({ current_period_end_date: renewEnd }), T0 + 30 * DAY),
  ]);
  assert.deepEqual(emails, ["welcome"]);
  assert.equal(row.ends_at, renewEnd);
  assert.equal(managedAt(row, T0 + 45 * DAY), true);
});

test("duplicate delivery changes nothing and sends nothing twice", () => {
  const e = event("subscription.paid", sub());
  const once = run([e]);
  const twice = run([e, e]);
  assert.deepEqual(twice.row, once.row);
  assert.deepEqual(twice.emails, ["welcome"]);
});

test("out-of-order: an older event can't undo a newer one", () => {
  const { row } = run([
    event("subscription.paid", sub(), T0),
    event("subscription.canceled", sub({ status: "canceled" }), T0 + 2 * DAY),
    event("subscription.past_due", sub(), T0 + DAY), // retried late
  ]);
  assert.equal(row.status, "cancelled");
});

test("subscription.update: switches the interval and period, keeps the status", () => {
  const end = new Date(T0 + 365 * DAY).toISOString();
  const { row, emails } = run([
    event("subscription.paid", sub()),
    event(
      "subscription.update",
      sub({ product: "prod_year", current_period_end_date: end, metadata: {} }),
      T0 + DAY,
    ),
  ]);
  assert.equal(row.billing_interval, "year");
  assert.equal(row.ends_at, end);
  assert.equal(row.status, "active");
  assert.deepEqual(emails, ["welcome"]);
});

test("scheduled_cancel: managed until the period end, then not", () => {
  const { row } = run([
    event("subscription.paid", sub()),
    event("subscription.scheduled_cancel", sub({ status: "scheduled_cancel" }), T0 + DAY),
  ]);
  assert.equal(row.cancel_at_period_end, true);
  assert.equal(row.status, "active");
  assert.equal(managedAt(row, T0 + 29 * DAY), true);
  assert.equal(managedAt(row, T0 + 31 * DAY), false);
});

test("resumed after a scheduled cancel: update with status active keeps Pro going", () => {
  const { row } = run([
    event("subscription.paid", sub()),
    event("subscription.scheduled_cancel", sub({ status: "scheduled_cancel" }), T0 + DAY),
    event("subscription.update", sub({ status: "active" }), T0 + 2 * DAY),
  ]);
  assert.equal(row.cancel_at_period_end, false);
});

test("past_due and unpaid: 7-day grace, one payment-failed email, recovery on paid", () => {
  const failed = run([
    event("subscription.paid", sub()),
    event("subscription.past_due", sub({ status: "past_due" }), T0 + 30 * DAY),
    event("subscription.unpaid", sub({ status: "unpaid" }), T0 + 31 * DAY),
  ]);
  assert.equal(failed.row.status, "past_due");
  assert.equal(failed.row.past_due_since, new Date(T0 + 30 * DAY).toISOString());
  assert.deepEqual(failed.emails, ["welcome", "payment_failed"]);
  assert.equal(managedAt(failed.row, T0 + 36 * DAY), true);
  assert.equal(managedAt(failed.row, T0 + 38 * DAY), false);

  const recovered = run([
    event("subscription.paid", sub()),
    event("subscription.past_due", sub(), T0 + 30 * DAY),
    event(
      "subscription.paid",
      sub({ current_period_end_date: new Date(T0 + 61 * DAY).toISOString() }),
      T0 + 32 * DAY,
    ),
  ]);
  assert.equal(recovered.row.status, "active");
  assert.equal(recovered.row.past_due_since, null);
  assert.deepEqual(recovered.emails, ["welcome", "payment_failed"]);
});

test("canceled and expired: Pro ends now, with an email", () => {
  for (const [type, status] of [
    ["subscription.canceled", "cancelled"],
    ["subscription.expired", "expired"],
  ]) {
    const { row, emails } = run([
      event("subscription.paid", sub()),
      event(type, sub(), T0 + 5 * DAY),
    ]);
    assert.equal(row.status, status, type);
    assert.deepEqual(emails, ["welcome", "ended"]);
    assert.equal(managedAt(row, T0 + 5 * DAY + 1000), false);
  }
});

test("refund.created: a full refund ends Pro immediately; a partial one doesn't", () => {
  const refund = (amount) =>
    event(
      "refund.created",
      {
        id: "ref_1",
        refund_amount: amount,
        transaction: { id: "tran_1", amount: 2900, amount_paid: 3509, subscription: "sub_1" },
        subscription: { id: "sub_1", product: "prod_month", customer: "cust_1" },
      },
      T0 + DAY,
    );
  const full = run([event("subscription.paid", sub()), refund(3509)]);
  assert.equal(full.row.status, "cancelled");
  assert.equal(managedAt(full.row, T0 + DAY + 1000), false);
  assert.deepEqual(full.emails, ["welcome", "ended"]);

  const partial = run([event("subscription.paid", sub()), refund(1000)]);
  assert.equal(partial.row.status, "active");
  assert.equal(managedAt(partial.row, T0 + DAY + 1000), true);
});

test("events for a subscription we never saw start are ignored; unknown types too", () => {
  assert.equal(run([event("subscription.past_due", sub())]).row, null);
  assert.equal(run([event("subscription.canceled", sub())]).row, null);
  assert.equal(changeFor(event("subscription.trialing", sub()), PRODUCTS), null);
  assert.equal(changeFor(event("dispute.created", {}), PRODUCTS), null);
});

test("after an end, a new payment brings Pro back", () => {
  const { row, emails } = run([
    event("subscription.paid", sub()),
    event("subscription.expired", sub(), T0 + 31 * DAY),
    event(
      "subscription.paid",
      sub({ current_period_end_date: new Date(T0 + 90 * DAY).toISOString() }),
      T0 + 60 * DAY,
    ),
  ]);
  assert.equal(row.status, "active");
  assert.deepEqual(emails, ["welcome", "ended", "welcome"]);
  assert.equal(managedAt(row, T0 + 61 * DAY), true);
});
