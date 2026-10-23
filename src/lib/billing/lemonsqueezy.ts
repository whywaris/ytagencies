import "server-only";

import type { Billing, BillingResult } from "@/lib/billing";
import { envValue, nextRow, type Email, type SubRow } from "@/lib/billing/events";
import {
  changeFor,
  checkoutBody,
  lsEnvProblems,
  parseEvent,
  refundOf,
  verifySignature,
} from "@/lib/billing/lemonsqueezy-events";
import { sendBillingEmail } from "@/lib/billing/notices";
import { alertAdmin } from "@/lib/email";
import { revalidateAgency } from "@/lib/revalidate";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

// Lemon Squeezy (merchant of record; docs.lemonsqueezy.com/api): REST in JSON:API with a Bearer
// API key. Plain fetch for the two calls we make (create a checkout, read the customer for its
// portal URL); the webhook payload rules are in lemonsqueezy-events.ts.

const API = "https://api.lemonsqueezy.com/v1";

/** Server-only settings, or null when any is missing. LEMONSQUEEZY_TEST_MODE=true: test mode. */
export function lsConfig() {
  const v = (name: string) => envValue(process.env, name);
  const apiKey = v("LEMONSQUEEZY_API_KEY");
  const storeId = v("LEMONSQUEEZY_STORE_ID");
  const monthly = v("LEMONSQUEEZY_VARIANT_MONTHLY");
  const yearly = v("LEMONSQUEEZY_VARIANT_YEARLY");
  if (!apiKey || !storeId || !monthly || !yearly) return null;
  return {
    apiKey,
    storeId,
    variants: { monthly, yearly },
    testMode: v("LEMONSQUEEZY_TEST_MODE") === "true",
  };
}

const FAILED = "We couldn't reach our payment provider. Please try again in a minute.";

async function call<T>(path: string, init: { method: "GET" | "POST"; body?: object }) {
  const config = lsConfig();
  if (!config) return { ok: false, error: "Payments aren't enabled yet." } as BillingResult<T>;
  try {
    const res = await fetch(`${API}${path}`, {
      method: init.method,
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("lemonsqueezy request failed", {
        path: path.replace(/\d+/g, "…"),
        status: res.status,
      });
      return { ok: false, error: FAILED } as BillingResult<T>;
    }
    return { ok: true, data: (await res.json()) as T } as BillingResult<T>;
  } catch {
    console.error("lemonsqueezy request failed", { path: path.replace(/\d+/g, "…") });
    return { ok: false, error: FAILED } as BillingResult<T>;
  }
}

type Resource<A> = { data?: { id?: string; attributes?: A } };

export const lemonSqueezy: Billing = {
  async createCheckout({ agencyId, userId, email, interval, successUrl }) {
    const config = lsConfig()!;
    const res = await call<Resource<{ url?: string }>>("/checkouts", {
      method: "POST",
      body: checkoutBody({ agencyId, userId, email, interval, redirectUrl: successUrl }, config),
    });
    if (!res.ok) return res;
    const url = res.data.data?.attributes?.url;
    if (!url?.startsWith("https://")) return { ok: false, error: FAILED };
    return { ok: true, data: { url } };
  },

  /** The customer's portal: a pre-signed URL valid 24 hours, so it's read fresh each time. */
  async portalUrl(customerId) {
    if (!/^[0-9]{1,20}$/.test(customerId)) return { ok: false, error: FAILED };
    const res = await call<Resource<{ urls?: { customer_portal?: string | null } }>>(
      `/customers/${customerId}`,
      { method: "GET" },
    );
    if (!res.ok) return res;
    const url = res.data.data?.attributes?.urls?.customer_portal;
    if (!url?.startsWith("https://")) return { ok: false, error: FAILED };
    return { ok: true, data: { url } };
  },
};

const SUB_COLUMNS =
  "id, agency_id, status, starts_at, ends_at, cancel_at_period_end, past_due_since, billing_interval, customer_id, last_event_at";

/**
 * POST /api/webhooks/lemonsqueezy. Verify → parse → skip if processed → apply → record. A failure
 * while applying returns 500 and leaves the event unprocessed, so Lemon Squeezy's retry (up to 3
 * more times) applies it again; applying twice is harmless (nextRow ignores events not newer than
 * the last one applied).
 */
export async function handleWebhook(rawBody: string, headers: Headers): Promise<Response> {
  const secret = envValue(process.env, "LEMONSQUEEZY_WEBHOOK_SECRET");
  if (!secret) return new Response("Not configured", { status: 503 });
  if (!verifySignature(rawBody, headers.get("x-signature"), secret))
    return new Response("Invalid signature", { status: 400 });
  const event = parseEvent(rawBody, headers.get("x-event-name"));
  if (!event) return new Response("Invalid event", { status: 400 });

  const db = createAdminClient();
  const seen = await db
    .from("billing_events")
    .select("processed_at")
    .eq("id", event.key)
    .maybeSingle();
  if (seen.error) return new Response("Try again", { status: 500 });
  if (seen.data?.processed_at) return Response.json({ received: true, duplicate: true });

  const config = lsConfig();
  const variants = config?.variants ?? {
    monthly: envValue(process.env, "LEMONSQUEEZY_VARIANT_MONTHLY"),
    yearly: envValue(process.env, "LEMONSQUEEZY_VARIANT_YEARLY"),
  };
  const change = changeFor(event, variants);
  let agencyId: string | null = change?.agencyId ?? null;

  // Refunds don't change the plan by themselves: logged, and the admin decides.
  const refund = refundOf(event);
  if (refund) {
    agencyId = refund.agencyId;
    console.info("lemonsqueezy refund received", { order: refund.orderId, agencyId });
    await alertAdmin("Lemon Squeezy refund", [
      `A ${refund.full ? "full" : "partial"} refund was made on order ${refund.orderId}.`,
      agencyId ? `Agency id: ${agencyId}` : "No agency id on the event.",
      "Pro isn't ended automatically: end it in Admin → Agencies → Change plan if needed.",
    ]);
  }

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
      // No agency to apply it to (e.g. custom data missing): recorded for the admin, not retried.
      console.error("lemonsqueezy event without agency", { event: event.name });
      agencyId = null;
    } else {
      const current = existing.data ? (existing.data as SubRow & { id: string }) : null;
      const next = nextRow(current, change, event.at);
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
    id: event.key,
    type: event.name,
    agency_id: agencyId,
    payload: JSON.parse(rawBody) as Json,
    processed_at: new Date().toISOString(),
  });
  if (error) console.error("billing event not recorded", { event: event.name });
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

async function notify(
  agency: { id: string; slug: string; name: string; owner_id: string | null },
  email: Email,
) {
  try {
    await sendBillingEmail(agency, email);
  } catch {
    console.error("billing email failed", { agencyId: agency.id, email });
  }
}

let lastUnavailableAlert = 0;

/**
 * Get Pro was clicked but checkout can't start: a clear server log naming the missing settings
 * (names only) and, at most hourly per server instance, an email to the admin.
 */
export async function reportCheckoutUnavailable() {
  const missing = lsEnvProblems(process.env);
  console.error("Lemon Squeezy checkout unavailable", { missing });
  if (Date.now() - lastUnavailableAlert < 3_600_000) return;
  lastUnavailableAlert = Date.now();
  await alertAdmin("Checkout is unavailable", [
    "Someone clicked Get Pro, but Lemon Squeezy checkout isn't configured.",
    missing.length
      ? `Missing or wrong: ${missing.join(", ")}.`
      : "The Lemon Squeezy request failed.",
    "Set them in Vercel → Settings → Environment Variables (see docs/LAUNCH.md), then redeploy.",
  ]);
}
