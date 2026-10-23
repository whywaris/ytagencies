// Lemon Squeezy webhooks → a Change for lib/billing/events.ts, plus the checkout request body and
// the env check. Pure (node:crypto only): tested in tests/lemonsqueezy.test.mjs.
// lib/billing/lemonsqueezy.ts does the I/O around it.
//
// Docs: docs.lemonsqueezy.com/help/webhooks. A webhook is a JSON:API resource: { meta: {
// event_name, custom_data }, data: { type, id, attributes } }, with headers X-Event-Name and
// X-Signature (hex HMAC-SHA256 of the raw body). Subscription events carry the subscription;
// subscription_payment_* carry a subscription invoice (attributes.subscription_id); order_refunded
// an order. custom_data is our checkout's checkout_data.custom: { agency_id, user_id, period }.
// There's no event id, so idempotency uses event name + object + its updated_at (eventKey).

import { createHmac, timingSafeEqual } from "node:crypto";

import type { Change, Interval } from "./events.ts";

/** X-Signature = hex HMAC-SHA256 of the raw body with the signing secret; constant-time compare. */
export function verifySignature(rawBody: string, header: string | null, secret: string) {
  if (!header || !secret) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
  const given = Buffer.from(header.trim());
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
/** Lemon Squeezy ids are numbers in attributes and strings in `data.id`: always a string here. */
const id = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0
    ? String(v)
    : typeof v === "string" && /^[0-9]{1,20}$/.test(v)
      ? v
      : null;
const str = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 200 ? v : null);
const date = (v: unknown) => {
  const s = str(v);
  return s && Number.isFinite(Date.parse(s)) ? new Date(s).toISOString() : null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LsEvent = {
  /** Idempotency key: event name, object type and id, and the object's updated_at. */
  key: string;
  name: string;
  /** When the object last changed: the event's time for ordering (retries arrive late). */
  at: Date;
  type: string;
  objectId: string;
  attributes: Record<string, unknown>;
  custom: Record<string, unknown>;
};

export function parseEvent(rawBody: string, headerName: string | null): LsEvent | null {
  let v: unknown;
  try {
    v = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!isObj(v) || !isObj(v.meta) || !isObj(v.data) || !isObj(v.data.attributes)) return null;
  const name = str(v.meta.event_name) ?? str(headerName);
  const type = str(v.data.type);
  const objectId = id(v.data.id);
  const updated = date(v.data.attributes.updated_at) ?? date(v.data.attributes.created_at);
  if (!name || !type || !objectId || !updated) return null;
  return {
    key: `${name}:${type}:${objectId}:${updated}`,
    name,
    at: new Date(updated),
    type,
    objectId,
    attributes: v.data.attributes,
    custom: isObj(v.meta.custom_data) ? v.meta.custom_data : {},
  };
}

/** The variants we sell (LEMONSQUEEZY_VARIANT_MONTHLY / _YEARLY). */
export type Variants = { monthly: string; yearly: string };

function intervalOf(variantId: unknown, custom: Record<string, unknown>, variants: Variants) {
  const v = id(variantId);
  if (v && v === variants.monthly) return "month" as const;
  if (v && v === variants.yearly) return "year" as const;
  if (custom.period === "monthly") return "month" as const;
  if (custom.period === "yearly") return "year" as const;
  return null;
}

/** What an event means for the subscription; null when it changes nothing we track. */
export function changeFor(e: LsEvent, variants: Variants): Change | null {
  const a = e.attributes;
  const agency = str(e.custom.agency_id);
  const common = {
    agencyId: agency && UUID.test(agency) ? agency.toLowerCase() : null,
    customerId: id(a.customer_id),
    interval: intervalOf(a.variant_id, e.custom, variants) as Interval | null,
  };

  if (e.name === "subscription_payment_success" || e.name === "subscription_payment_failed") {
    // A subscription invoice: the subscription is attributes.subscription_id.
    const subscriptionId = id(a.subscription_id);
    if (!subscriptionId) return null;
    return {
      ...common,
      subscriptionId,
      periodEnd: null,
      kind: e.name === "subscription_payment_success" ? "paid" : "past_due",
    };
  }
  if (e.type !== "subscriptions") return null; // order_refunded and others: handled elsewhere

  const subscriptionId = e.objectId;
  const status = str(a.status);
  const renews = date(a.renews_at);
  const ends = date(a.ends_at);
  const base = { ...common, subscriptionId };
  switch (e.name) {
    case "subscription_created":
      return { ...base, periodEnd: renews, kind: "activate" };
    case "subscription_cancelled":
      // Still Pro until the period ends (ends_at).
      return { ...base, periodEnd: ends ?? renews, kind: "scheduled_cancel" };
    case "subscription_resumed":
      return { ...base, periodEnd: renews, kind: "update", cancelAtPeriodEnd: false };
    case "subscription_expired":
      return { ...base, periodEnd: ends, kind: "end", endStatus: "expired" };
    case "subscription_updated":
      // The status says what changed (renewed, cancelled, failed payment, expired).
      if (status === "active" || status === "on_trial")
        return { ...base, periodEnd: renews, kind: "update", cancelAtPeriodEnd: false };
      if (status === "cancelled")
        return { ...base, periodEnd: ends ?? renews, kind: "scheduled_cancel" };
      if (status === "past_due" || status === "unpaid")
        return { ...base, periodEnd: renews, kind: "past_due" };
      if (status === "expired")
        return { ...base, periodEnd: ends, kind: "end", endStatus: "expired" };
      return null; // paused: no change for Pro
    default:
      return null;
  }
}

/** The order on an order_refunded event, for the admin email (no plan change). */
export function refundOf(e: LsEvent) {
  if (e.name !== "order_refunded" || e.type !== "orders") return null;
  const agency = str(e.custom.agency_id);
  return {
    orderId: e.objectId,
    agencyId: agency && UUID.test(agency) ? agency.toLowerCase() : null,
    full: e.attributes.refunded === true,
    status: str(e.attributes.status),
  };
}

/** POST /v1/checkouts body (JSON:API): the variant, prefilled email, our custom data, redirect. */
export function checkoutBody(
  input: {
    agencyId: string;
    userId: string;
    email: string | null;
    interval: Interval;
    redirectUrl: string;
  },
  config: { storeId: string; variants: Variants; testMode: boolean },
) {
  return {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          ...(input.email ? { email: input.email } : {}),
          custom: {
            agency_id: input.agencyId,
            user_id: input.userId,
            period: input.interval === "year" ? "yearly" : "monthly",
          },
        },
        product_options: { redirect_url: input.redirectUrl },
        test_mode: config.testMode,
      },
      relationships: {
        store: { data: { type: "stores", id: config.storeId } },
        variant: {
          data: {
            type: "variants",
            id: input.interval === "year" ? config.variants.yearly : config.variants.monthly,
          },
        },
      },
    },
  };
}

const clean = (env: Record<string, string | undefined>, name: string) =>
  (env[name] ?? "")
    .trim()
    .replace(/^(["'])([^]*)\1$/, "$2")
    .trim();

/**
 * What's missing for checkout, by variable name (never values). Empty when Get Pro can start a
 * checkout. PAYMENTS_ENABLED stays the on/off switch (SECURITY.md).
 */
export function lsEnvProblems(env: Record<string, string | undefined>) {
  const v = (name: string) => clean(env, name);
  const missing: string[] = [];
  if (v("PAYMENTS_ENABLED") !== "true") missing.push("PAYMENTS_ENABLED (must be true)");
  if (!v("LEMONSQUEEZY_API_KEY")) missing.push("LEMONSQUEEZY_API_KEY");
  for (const name of [
    "LEMONSQUEEZY_STORE_ID",
    "LEMONSQUEEZY_VARIANT_MONTHLY",
    "LEMONSQUEEZY_VARIANT_YEARLY",
  ]) {
    if (!v(name)) missing.push(name);
    else if (!/^[0-9]{1,20}$/.test(v(name))) missing.push(`${name} (a number from the dashboard)`);
  }
  if (
    v("LEMONSQUEEZY_VARIANT_MONTHLY") &&
    v("LEMONSQUEEZY_VARIANT_MONTHLY") === v("LEMONSQUEEZY_VARIANT_YEARLY")
  )
    missing.push("LEMONSQUEEZY_VARIANT_MONTHLY (same variant as LEMONSQUEEZY_VARIANT_YEARLY)");
  const mode = v("LEMONSQUEEZY_TEST_MODE");
  if (mode && mode !== "true" && mode !== "false")
    missing.push("LEMONSQUEEZY_TEST_MODE (true or false)");
  return missing;
}
