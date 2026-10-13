import "server-only";

import { randomUUID } from "node:crypto";

import type { Billing, BillingResult } from "@/lib/billing";
import {
  changeFor,
  nextRow,
  parseCreemEvent,
  verifyCreemSignature,
  type Email,
  type SubRow,
} from "@/lib/billing/creem-events";
import { sendBillingEmail } from "@/lib/billing/notices";
import { revalidateAgency } from "@/lib/revalidate";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

// Creem (https://docs.creem.io): REST with the x-api-key header. Plain fetch for the four calls we
// make (checkout, customer portal, upgrade, resume) rather than the SDK: field names are from the
// API reference, and the webhook payload types we need are our own (creem-events.ts) either way.

/** Server-only Creem settings, or null when any is missing. CREEM_TEST_MODE picks the sandbox. */
export function creemConfig() {
  const apiKey = process.env.CREEM_API_KEY;
  const monthly = process.env.CREEM_PRODUCT_PRO_MONTHLY;
  const yearly = process.env.CREEM_PRODUCT_PRO_YEARLY;
  if (!apiKey || !monthly || !yearly) return null;
  const test = process.env.CREEM_TEST_MODE === "true";
  return {
    apiKey,
    products: { monthly, yearly },
    test,
    baseUrl: test ? "https://test-api.creem.io/v1" : "https://api.creem.io/v1",
  };
}

const FAILED = "We couldn't reach our payment provider. Please try again in a minute.";

async function call<T>(path: string, body?: object): Promise<BillingResult<T>> {
  const config = creemConfig();
  if (!config) return { ok: false, error: "Payments aren't enabled yet." };
  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: { "x-api-key": config.apiKey, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("creem request failed", {
        path: path.replace(/sub_\w+/, "sub_…"),
        status: res.status,
      });
      return { ok: false, error: FAILED };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    console.error("creem request failed", { path: path.replace(/sub_\w+/, "sub_…") });
    return { ok: false, error: FAILED };
  }
}

const SUB_ID = /^sub_[A-Za-z0-9]{1,100}$/;
const CUST_ID = /^cust_[A-Za-z0-9]{1,100}$/;

export const creem: Billing = {
  async createCheckout({ agencyId, userId, email, interval, successUrl }) {
    const config = creemConfig()!;
    const res = await call<{ checkout_url?: string }>("/checkouts", {
      product_id: interval === "year" ? config.products.yearly : config.products.monthly,
      // The docs describe request_id as tracking only, not idempotency (see LAUNCH.md).
      request_id: `${agencyId}:${randomUUID()}`,
      success_url: successUrl,
      ...(email ? { customer: { email } } : {}),
      metadata: { agency_id: agencyId, user_id: userId, interval },
    });
    if (!res.ok) return res;
    const url = res.data.checkout_url;
    if (!url?.startsWith("https://")) return { ok: false, error: FAILED };
    return { ok: true, data: { url } };
  },

  async portalUrl(customerId) {
    if (!CUST_ID.test(customerId)) return { ok: false, error: FAILED };
    const res = await call<{ customer_portal_link?: string }>("/customers/billing", {
      customer_id: customerId,
    });
    if (!res.ok) return res;
    const url = res.data.customer_portal_link;
    if (!url?.startsWith("https://")) return { ok: false, error: FAILED };
    return { ok: true, data: { url } };
  },

  async switchToYearly(subscriptionId) {
    if (!SUB_ID.test(subscriptionId)) return { ok: false, error: FAILED };
    const res = await call(`/subscriptions/${subscriptionId}/upgrade`, {
      product_id: creemConfig()!.products.yearly,
      update_behavior: "proration-charge-immediately",
    });
    return res.ok ? { ok: true, data: null } : res;
  },

  async resume(subscriptionId) {
    if (!SUB_ID.test(subscriptionId)) return { ok: false, error: FAILED };
    const res = await call(`/subscriptions/${subscriptionId}/resume`);
    return res.ok ? { ok: true, data: null } : res;
  },
};

const SUB_COLUMNS =
  "id, agency_id, status, starts_at, ends_at, cancel_at_period_end, past_due_since, billing_interval, customer_id, last_event_at";

/**
 * POST /api/billing/webhook. Verify → parse → skip if processed → apply → record. A failure while
 * applying returns 500 and leaves the event unprocessed, so Creem's retry applies it again;
 * applying twice is harmless (nextRow ignores events not newer than the last one applied).
 */
export async function handleCreemWebhook(request: Request): Promise<Response> {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) return new Response("Not configured", { status: 503 });
  const raw = await request.text();
  if (!verifyCreemSignature(raw, request.headers.get("creem-signature"), secret))
    return new Response("Invalid signature", { status: 400 });
  const event = parseCreemEvent(raw);
  if (!event) return new Response("Invalid event", { status: 400 });

  const db = createAdminClient();
  const seen = await db
    .from("billing_events")
    .select("processed_at")
    .eq("id", event.id)
    .maybeSingle();
  if (seen.error) return new Response("Try again", { status: 500 });
  if (seen.data?.processed_at) return Response.json({ received: true, duplicate: true });

  const products = creemConfig()?.products ?? {
    monthly: process.env.CREEM_PRODUCT_PRO_MONTHLY ?? "",
    yearly: process.env.CREEM_PRODUCT_PRO_YEARLY ?? "",
  };
  const change = changeFor(event, products);
  let agencyId: string | null = change?.agencyId ?? null;

  if (change) {
    const existing = await db
      .from("agency_subscriptions")
      .select(SUB_COLUMNS)
      .eq("source", "payment")
      .eq("external_id", change.subscriptionId)
      .maybeSingle();
    if (existing.error) return new Response("Try again", { status: 500 });
    agencyId = existing.data?.agency_id ?? agencyId;

    const agency = agencyId
      ? await db
          .from("agencies")
          .select("id, slug, name, owner_id")
          .eq("id", agencyId)
          .maybeSingle()
      : null;
    if (agency?.error) return new Response("Try again", { status: 500 });

    if (!agency?.data) {
      // No agency to apply it to (e.g. metadata missing): recorded for the admin, not retried.
      console.error("creem event without agency", { event: event.id, type: event.eventType });
      agencyId = null;
    } else {
      const current = existing.data ? (existing.data as SubRow & { id: string }) : null;
      const next = nextRow(current, change, new Date(event.created_at));
      if (next) {
        const applied = await applyRow(
          db,
          agency.data.id,
          change.subscriptionId,
          current,
          next.row,
        );
        if (!applied) return new Response("Try again", { status: 500 });
        revalidateAgency(agency.data.slug);
        if (next.email) await notify(agency.data, next.email);
      }
    }
  }

  const { error } = await db.from("billing_events").upsert({
    id: event.id,
    type: event.eventType,
    agency_id: agencyId,
    payload: JSON.parse(raw) as Json,
    processed_at: new Date().toISOString(),
  });
  if (error) console.error("billing event not recorded", { event: event.id });
  return Response.json({ received: true });
}

type Db = ReturnType<typeof createAdminClient>;

async function applyRow(
  db: Db,
  agencyId: string,
  subscriptionId: string,
  current: (SubRow & { id: string }) | null,
  row: SubRow,
) {
  const rowId = current?.id ?? null;
  const now = new Date().toISOString();
  if (row.status === "active" || row.status === "past_due") {
    // One live subscription per agency: a payment replaces a manual grant (or an older one).
    let others = db
      .from("agency_subscriptions")
      .update({
        status: "cancelled",
        ends_at: now,
        cancel_at_period_end: false,
        past_due_since: null,
      })
      .eq("agency_id", agencyId)
      .in("status", ["active", "past_due"]);
    if (rowId) others = others.neq("id", rowId);
    const { error } = await others;
    if (error) return false;
  }
  const values = {
    status: row.status,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    cancel_at_period_end: row.cancel_at_period_end,
    past_due_since: row.past_due_since,
    billing_interval: row.billing_interval,
    customer_id: row.customer_id,
    last_event_at: row.last_event_at,
    // A new end date (renewed, resumed, cancelled again) gets a new "ends in 3 days" notice.
    ...(current?.ends_at !== row.ends_at ? { ending_notice_sent_at: null } : {}),
  };
  const { error } = rowId
    ? await db.from("agency_subscriptions").update(values).eq("id", rowId)
    : await db.from("agency_subscriptions").insert({
        ...values,
        agency_id: agencyId,
        plan_id: "pro",
        source: "payment",
        external_id: subscriptionId,
      });
  if (error) console.error("subscription write failed", { code: error.code });
  return !error;
}

async function notify(agency: { id: string; name: string; owner_id: string | null }, email: Email) {
  try {
    await sendBillingEmail(agency, email);
  } catch {
    console.error("billing email failed", { agencyId: agency.id, email });
  }
}
