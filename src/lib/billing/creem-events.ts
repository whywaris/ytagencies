// Creem webhooks → agency_subscriptions. Pure (node:crypto only): tested in
// tests/creem-events.test.mjs. lib/billing/creem.ts does the I/O around it.
//
// Docs: https://docs.creem.io/code/webhooks. Every event is { id, eventType, created_at (ms),
// object }. Subscription events carry the subscription as `object`; checkout.completed and
// refund.created embed it as `object.subscription`. Our checkout metadata (agency_id, user_id,
// interval) is copied onto the subscription, so later events find the agency through it, or
// through the stored Creem subscription id.

import { createHmac, timingSafeEqual } from "node:crypto";

export type Interval = "month" | "year";

export type CreemEvent = {
  id: string;
  eventType: string;
  /** Milliseconds since the epoch. */
  created_at: number;
  object: Record<string, unknown>;
};

/** creem-signature = hex HMAC-SHA256 of the raw body, keyed with the webhook secret. */
export function verifyCreemSignature(rawBody: string, header: string | null, secret: string) {
  if (!header || !secret) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
  const given = Buffer.from(header.trim());
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 200 ? v : null);
/** An embedded entity's id, whether Creem sent the object or just its id. */
const idOf = (v: unknown) => (isObj(v) ? str(v.id) : str(v));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseCreemEvent(rawBody: string): CreemEvent | null {
  let v: unknown;
  try {
    v = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!isObj(v) || !str(v.id) || !str(v.eventType) || !isObj(v.object)) return null;
  const created =
    typeof v.created_at === "number" ? v.created_at : Date.parse(String(v.created_at));
  if (!Number.isFinite(created)) return null;
  return {
    id: v.id as string,
    eventType: v.eventType as string,
    created_at: created,
    object: v.object,
  };
}

export type Change = {
  /** Creem subscription id (agency_subscriptions.external_id). */
  subscriptionId: string;
  /** From our checkout metadata, when present. */
  agencyId: string | null;
  customerId: string | null;
  interval: Interval | null;
  /** current_period_end_date, ISO. */
  periodEnd: string | null;
  kind: "activate" | "update" | "scheduled_cancel" | "past_due" | "end";
  /** Creem's own status on the subscription (e.g. "active" after a resume). */
  creemStatus: string | null;
  /** For kind "end": how it ended. */
  endStatus?: "cancelled" | "expired";
};

/** The products we sell, to tell monthly from yearly when the product isn't embedded. */
export type Products = { monthly: string; yearly: string };

function intervalOf(product: unknown, metadata: unknown, products: Products): Interval | null {
  if (isObj(product)) {
    if (product.billing_period === "every-month") return "month";
    if (product.billing_period === "every-year") return "year";
  }
  const id = idOf(product);
  if (id && id === products.monthly) return "month";
  if (id && id === products.yearly) return "year";
  if (isObj(metadata) && (metadata.interval === "month" || metadata.interval === "year"))
    return metadata.interval;
  return null;
}

function fromSubscription(
  sub: Record<string, unknown>,
  products: Products,
  extra: { metadata?: unknown; customer?: unknown } = {},
) {
  const subscriptionId = str(sub.id);
  if (!subscriptionId) return null;
  const metadata = isObj(sub.metadata) ? sub.metadata : extra.metadata;
  const agency = isObj(metadata) ? str(metadata.agency_id) : null;
  const end = str(sub.current_period_end_date);
  return {
    subscriptionId,
    agencyId: agency && UUID.test(agency) ? agency.toLowerCase() : null,
    customerId: idOf(sub.customer) ?? idOf(extra.customer),
    interval: intervalOf(sub.product, metadata, products),
    periodEnd: end && Number.isFinite(Date.parse(end)) ? new Date(end).toISOString() : null,
    creemStatus: str(sub.status),
  };
}

/** What an event means for the subscription, or null when it changes nothing we track. */
export function changeFor(event: CreemEvent, products: Products): Change | null {
  const o = event.object;
  switch (event.eventType) {
    case "checkout.completed": {
      // The checkout's own metadata is ours too; the embedded subscription may carry less.
      const sub = isObj(o.subscription) ? o.subscription : { id: o.subscription };
      const base = fromSubscription(sub, products, { metadata: o.metadata, customer: o.customer });
      if (!base) return null; // a one-time order: not Pro
      if (!base.agencyId && isObj(o.metadata)) {
        const a = str(o.metadata.agency_id);
        if (a && UUID.test(a)) base.agencyId = a.toLowerCase();
      }
      if (!base.interval) base.interval = intervalOf(o.product, o.metadata, products);
      return { ...base, kind: "activate" };
    }
    case "subscription.active":
    case "subscription.paid": {
      const base = fromSubscription(o, products);
      return base && { ...base, kind: "activate" };
    }
    case "subscription.update": {
      const base = fromSubscription(o, products);
      return base && { ...base, kind: "update" };
    }
    case "subscription.scheduled_cancel": {
      const base = fromSubscription(o, products);
      return base && { ...base, kind: "scheduled_cancel" };
    }
    case "subscription.past_due":
    case "subscription.unpaid": {
      const base = fromSubscription(o, products);
      return base && { ...base, kind: "past_due" };
    }
    case "subscription.canceled":
    case "subscription.expired": {
      const base = fromSubscription(o, products);
      const endStatus = event.eventType === "subscription.expired" ? "expired" : "cancelled";
      return base && { ...base, kind: "end", endStatus };
    }
    case "refund.created": {
      // Only a full refund ends Pro: refund_amount covers what was paid for the transaction.
      // Both are in minor units in the docs' example (refund_amount 1210 = amount_paid 1210).
      const tx = isObj(o.transaction) ? o.transaction : null;
      const refunded = Number(o.refund_amount);
      const paid = tx ? Number(tx.amount_paid ?? tx.amount) : NaN;
      if (!Number.isFinite(refunded) || !Number.isFinite(paid) || refunded < paid) return null;
      const sub = isObj(o.subscription)
        ? o.subscription
        : { id: o.subscription ?? tx?.subscription };
      const base = fromSubscription(sub, products, { customer: o.customer });
      return base && { ...base, kind: "end", endStatus: "cancelled" };
    }
    default:
      return null; // trialing, paused, disputes, credits: nothing to do for Pro
  }
}

export type SubRow = {
  status: "active" | "past_due" | "expired" | "cancelled";
  starts_at: string;
  ends_at: string | null;
  cancel_at_period_end: boolean;
  past_due_since: string | null;
  billing_interval: Interval | null;
  customer_id: string | null;
  last_event_at: string | null;
};

export type Email = "welcome" | "payment_failed" | "ended";

const LIVE = new Set(["active", "past_due"]);

/**
 * The subscription row after a change, and the email it calls for. Null when there's nothing to
 * write: an event older than the last one applied (retries arrive out of order), or a change to
 * a subscription we never saw start, or one that already ended.
 */
export function nextRow(
  current: SubRow | null,
  change: Change,
  at: Date,
): { row: SubRow; email: Email | null; created: boolean } | null {
  const iso = at.toISOString();
  if (current?.last_event_at && at.getTime() < Date.parse(current.last_event_at)) return null;
  if (!current && change.kind !== "activate" && change.kind !== "scheduled_cancel") return null;

  const base: SubRow = current ?? {
    status: "active",
    starts_at: iso,
    ends_at: null,
    cancel_at_period_end: false,
    past_due_since: null,
    billing_interval: null,
    customer_id: null,
    last_event_at: null,
  };
  const live = current ? LIVE.has(current.status) : false;
  const common = {
    billing_interval: change.interval ?? base.billing_interval,
    customer_id: change.customerId ?? base.customer_id,
    last_event_at: iso,
  };
  // ends_at must be after starts_at (table check); a period end before it is ignored.
  const endsAt = (end: string | null) =>
    end && Date.parse(end) > Date.parse(base.starts_at) ? end : base.ends_at;

  switch (change.kind) {
    case "activate":
      return {
        row: {
          ...base,
          ...common,
          status: "active",
          ends_at: endsAt(change.periodEnd),
          cancel_at_period_end: false,
          past_due_since: null,
        },
        email: live ? null : "welcome",
        created: !current,
      };
    case "scheduled_cancel":
      if (current && !live) return null;
      return {
        row: {
          ...base,
          ...common,
          status: "active",
          ends_at: endsAt(change.periodEnd),
          cancel_at_period_end: true,
          past_due_since: null,
        },
        email: current ? null : "welcome",
        created: !current,
      };
    case "update":
      if (!live) return null;
      return {
        row: {
          ...base,
          ...common,
          ends_at: endsAt(change.periodEnd),
          // A resumed subscription reports "active" again; a cancel shows as scheduled_cancel.
          cancel_at_period_end:
            change.creemStatus === "active"
              ? false
              : change.creemStatus === "scheduled_cancel"
                ? true
                : base.cancel_at_period_end,
        },
        email: null,
        created: false,
      };
    case "past_due":
      if (!live) return null;
      return {
        row: {
          ...base,
          ...common,
          status: "past_due",
          past_due_since: base.past_due_since ?? iso,
        },
        email: base.status === "past_due" ? null : "payment_failed",
        created: false,
      };
    case "end":
      if (!live) return null;
      return {
        row: {
          ...base,
          ...common,
          status: change.endStatus ?? "cancelled",
          // Ends now; null if "now" isn't after the start (the status alone ends it).
          ends_at: at.getTime() > Date.parse(base.starts_at) ? iso : null,
          cancel_at_period_end: false,
          past_due_since: null,
        },
        email: "ended",
        created: false,
      };
  }
}
