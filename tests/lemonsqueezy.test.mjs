// Lemon Squeezy billing (src/lib/billing/lemonsqueezy-events.ts → src/lib/billing/events.ts):
// checkout per period, the X-Signature check, idempotency, and what each event does to Pro.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import { envValue, nextRow } from "../src/lib/billing/events.ts";
import {
  changeFor,
  checkoutBody,
  lsEnvProblems,
  parseEvent,
  refundOf,
  verifySignature,
} from "../src/lib/billing/lemonsqueezy-events.ts";
import { entitlementsFor } from "../src/lib/entitlements.ts";

const SECRET = "ls_signing_secret";
const VARIANTS = { monthly: "111", yearly: "222" };
const AGENCY = "00000000-0000-4000-8000-0000000000aa";
const T0 = Date.parse("2026-10-13T10:00:00Z");
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const sign = (body, secret = SECRET) => createHmac("sha256", secret).update(body).digest("hex");
const custom = { agency_id: AGENCY, user_id: "u1", period: "monthly" };

/** A webhook body: { meta: { event_name, custom_data }, data: { type, id, attributes } }. */
const body = (name, attributes, { type = "subscriptions", id = "9001", at = T0 } = {}) =>
  JSON.stringify({
    meta: { event_name: name, custom_data: custom },
    data: { type, id, attributes: { updated_at: iso(at), ...attributes } },
  });
const subscription = (name, extra = {}, at = T0) =>
  body(
    name,
    {
      status: "active",
      customer_id: 77,
      variant_id: 111,
      renews_at: iso(at + 30 * DAY),
      ends_at: null,
      ...extra,
    },
    { at },
  );
const invoice = (name, at) =>
  body(
    name,
    {
      subscription_id: 9001,
      customer_id: 77,
      status: name.endsWith("success") ? "paid" : "pending",
    },
    {
      type: "subscription-invoices",
      id: String(at),
      at,
    },
  );

/** Applies webhook bodies in order, like the handler does (one row per LS subscription). */
function run(bodies) {
  let row = null;
  const emails = [];
  const seen = new Set();
  for (const raw of bodies) {
    const e = parseEvent(raw, null);
    if (!e || seen.has(e.key)) continue; // billing_events: processed keys are skipped
    seen.add(e.key);
    const change = changeFor(e, VARIANTS);
    if (!change) continue;
    const next = nextRow(row, change, e.at);
    if (!next) continue;
    row = next.row;
    if (next.email) emails.push(next.email);
  }
  return { row, emails };
}
const managedAt = (row, at) =>
  entitlementsFor({
    subscriptions: row ? [{ plan_id: "pro", ...row }] : [],
    verificationApproved: false,
    now: new Date(at),
  }).managed;

test("checkout: the variant per period, custom data, prefilled email, redirect, test mode", () => {
  const config = { storeId: "42", variants: VARIANTS, testMode: true };
  const input = {
    agencyId: AGENCY,
    userId: "u1",
    email: "owner@acme.test",
    redirectUrl: "https://ytagencies.com/dashboard/acme/billing/success",
  };
  const month = checkoutBody({ ...input, interval: "month" }, config).data;
  assert.equal(month.type, "checkouts");
  assert.deepEqual(month.relationships.store.data, { type: "stores", id: "42" });
  assert.deepEqual(month.relationships.variant.data, { type: "variants", id: "111" });
  assert.deepEqual(month.attributes.checkout_data, {
    email: "owner@acme.test",
    custom: { agency_id: AGENCY, user_id: "u1", period: "monthly" },
  });
  assert.equal(month.attributes.product_options.redirect_url, input.redirectUrl);
  assert.equal(month.attributes.test_mode, true);
  const year = checkoutBody({ ...input, email: null, interval: "year" }, config).data;
  assert.equal(year.relationships.variant.data.id, "222");
  assert.equal(year.attributes.checkout_data.custom.period, "yearly");
  assert.equal("email" in year.attributes.checkout_data, false);
});

test("signature: valid, invalid, tampered, missing, wrong secret", () => {
  const raw = subscription("subscription_created");
  assert.equal(verifySignature(raw, sign(raw), SECRET), true);
  assert.equal(verifySignature(raw, "deadbeef", SECRET), false);
  assert.equal(verifySignature(`${raw} `, sign(raw), SECRET), false);
  assert.equal(verifySignature(raw, null, SECRET), false);
  assert.equal(verifySignature(raw, sign(raw, "other"), SECRET), false);
  assert.equal(verifySignature(raw, sign(raw), ""), false);
});

test("parse: rejects malformed events; the key is stable for a redelivery", () => {
  assert.equal(parseEvent("not json", null), null);
  assert.equal(parseEvent(JSON.stringify({ meta: {}, data: {} }), null), null);
  const raw = subscription("subscription_created");
  assert.equal(parseEvent(raw, null).key, parseEvent(raw, null).key);
  assert.equal(parseEvent(raw, null).key, `subscription_created:subscriptions:9001:${iso(T0)}`);
});

test("subscription_created: Pro starts with agency, customer and interval; one welcome email", () => {
  const { row, emails } = run([subscription("subscription_created")]);
  assert.equal(row.status, "active");
  assert.equal(row.customer_id, "77");
  assert.equal(row.billing_interval, "month");
  assert.equal(row.ends_at, iso(T0 + 30 * DAY));
  assert.deepEqual(emails, ["welcome"]);
  assert.equal(managedAt(row, T0 + DAY), true);
});

test("duplicate delivery: skipped by key, nothing changes or is sent twice", () => {
  const raw = subscription("subscription_created");
  assert.deepEqual(run([raw, raw, raw]).emails, ["welcome"]);
});

test("subscription_updated: renewal extends the period; yearly variant switches the interval", () => {
  const { row } = run([
    subscription("subscription_created"),
    subscription(
      "subscription_updated",
      { variant_id: 222, renews_at: iso(T0 + 365 * DAY) },
      T0 + DAY,
    ),
  ]);
  assert.equal(row.billing_interval, "year");
  assert.equal(row.ends_at, iso(T0 + 365 * DAY));
});

test("payment_failed: past_due with the 7-day grace and one email; payment_success recovers", () => {
  const failed = run([
    subscription("subscription_created"),
    invoice("subscription_payment_failed", T0 + 31 * DAY),
    invoice("subscription_payment_failed", T0 + 32 * DAY),
  ]);
  assert.equal(failed.row.status, "past_due");
  assert.equal(failed.row.past_due_since, iso(T0 + 31 * DAY));
  assert.deepEqual(failed.emails, ["welcome", "payment_failed"]);
  assert.equal(managedAt(failed.row, T0 + 37 * DAY), true, "within the grace");
  assert.equal(managedAt(failed.row, T0 + 39 * DAY), false, "after 7 days");
  const recovered = run([
    subscription("subscription_created"),
    invoice("subscription_payment_failed", T0 + 31 * DAY),
    invoice("subscription_payment_success", T0 + 32 * DAY),
  ]);
  assert.equal(recovered.row.status, "active");
  assert.equal(recovered.row.past_due_since, null);
});

test("cancelled: still Pro until the period end, then not; resumed keeps it going", () => {
  const end = T0 + 30 * DAY;
  const cancelled = run([
    subscription("subscription_created"),
    subscription(
      "subscription_cancelled",
      { status: "cancelled", cancelled: true, ends_at: iso(end) },
      T0 + DAY,
    ),
  ]);
  assert.equal(cancelled.row.cancel_at_period_end, true);
  assert.equal(managedAt(cancelled.row, end - DAY), true);
  assert.equal(managedAt(cancelled.row, end + 1000), false);
  const resumed = run([
    subscription("subscription_created"),
    subscription("subscription_cancelled", { status: "cancelled", ends_at: iso(end) }, T0 + DAY),
    subscription("subscription_resumed", { status: "active", renews_at: iso(end) }, T0 + 2 * DAY),
  ]);
  assert.equal(resumed.row.cancel_at_period_end, false);
  assert.equal(resumed.row.status, "active");
});

test("expired: lapsed now, with an email", () => {
  const { row, emails } = run([
    subscription("subscription_created"),
    subscription(
      "subscription_expired",
      { status: "expired", ends_at: iso(T0 + 40 * DAY) },
      T0 + 40 * DAY,
    ),
  ]);
  assert.equal(row.status, "expired");
  assert.deepEqual(emails, ["welcome", "ended"]);
  assert.equal(managedAt(row, T0 + 41 * DAY), false);
});

test("out of order: an older event can't undo a newer one", () => {
  const { row } = run([
    subscription("subscription_created"),
    subscription("subscription_expired", { status: "expired" }, T0 + 40 * DAY),
    subscription("subscription_updated", { status: "active" }, T0 + 10 * DAY),
  ]);
  assert.equal(row.status, "expired");
});

test("order_refunded: logged for the admin, no plan change", () => {
  const raw = body(
    "order_refunded",
    { status: "refunded", refunded: true },
    { type: "orders", id: "5" },
  );
  const e = parseEvent(raw, null);
  assert.equal(changeFor(e, VARIANTS), null);
  assert.deepEqual(refundOf(e), { orderId: "5", agencyId: AGENCY, full: true, status: "refunded" });
});

test("events for a subscription we never saw start are ignored", () => {
  assert.equal(run([subscription("subscription_updated")]).row, null);
  assert.equal(run([invoice("subscription_payment_success", T0)]).row, null);
});

test("env: names what's missing or wrong, never values; pasted spaces and quotes are fine", () => {
  const ok = {
    PAYMENTS_ENABLED: ' "true"\n',
    LEMONSQUEEZY_API_KEY: "key ",
    LEMONSQUEEZY_STORE_ID: "42",
    LEMONSQUEEZY_VARIANT_MONTHLY: "111",
    LEMONSQUEEZY_VARIANT_YEARLY: "222",
  };
  assert.deepEqual(lsEnvProblems(ok), []);
  assert.deepEqual(lsEnvProblems({}), [
    "PAYMENTS_ENABLED (must be true)",
    "LEMONSQUEEZY_API_KEY",
    "LEMONSQUEEZY_STORE_ID",
    "LEMONSQUEEZY_VARIANT_MONTHLY",
    "LEMONSQUEEZY_VARIANT_YEARLY",
  ]);
  assert.match(lsEnvProblems({ ...ok, LEMONSQUEEZY_VARIANT_YEARLY: "111" }).join(), /same variant/);
  assert.match(lsEnvProblems({ ...ok, LEMONSQUEEZY_STORE_ID: "my-store" }).join(), /a number/);
  assert.ok(
    !lsEnvProblems({ ...ok, LEMONSQUEEZY_API_KEY: "" })
      .join()
      .includes("key "),
  );
  assert.equal(envValue({ X: " 'a' " }, "X"), "a");
});
