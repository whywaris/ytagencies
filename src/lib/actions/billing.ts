"use server";

import { redirect } from "next/navigation";

import { billing, checkoutAvailable, type Interval } from "@/lib/billing";
import { getOwnedAgency, getUser } from "@/lib/auth";
import { isManaged } from "@/lib/entitlements";
import { absoluteUrl } from "@/lib/site";

// Dashboard → Billing (Creem). Each action re-checks ownership: owner_id is only set after a
// verified claim or an approved submission (SECURITY.md). Called from plain <form action>s bound
// to (agencyId, …); failures come back to the Billing page as ?error=.

const billingPage = (agencyId: string, query = "") => `/dashboard/${agencyId}/billing${query}`;

async function owned(agencyId: string) {
  const o = await getOwnedAgency(agencyId);
  if (!o) redirect("/dashboard");
  return o;
}

/** The agency's latest Creem subscription (owners read their own rows under RLS). */
async function paymentRow(o: Awaited<ReturnType<typeof owned>>) {
  const { data } = await o.supabase
    .from("agency_subscriptions")
    .select("external_id, customer_id, status, billing_interval, cancel_at_period_end")
    .eq("agency_id", o.agency.id)
    .eq("source", "payment")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function startCheckout(agencyId: string, interval: Interval) {
  if (interval !== "month" && interval !== "year") redirect(billingPage(agencyId));
  const o = await owned(agencyId);
  const user = await getUser();
  if (!user || !checkoutAvailable()) redirect(billingPage(agencyId, "?error=unavailable"));

  // Already managed: nothing to buy (switching to yearly is its own button).
  const { data: subs } = await o.supabase
    .from("agency_subscriptions")
    .select("plan_id, status, starts_at, ends_at, cancel_at_period_end, past_due_since")
    .eq("agency_id", o.agency.id);
  if (isManaged(subs ?? [])) redirect(billingPage(agencyId));

  const res = await billing().createCheckout({
    agencyId: o.agency.id,
    userId: user.id,
    email: user.email ?? null,
    interval,
    successUrl: absoluteUrl(`/dashboard/billing?status=success&agency=${o.agency.id}`),
  });
  if (!res.ok) redirect(billingPage(agencyId, "?error=checkout"));
  redirect(res.data.url);
}

export async function openBillingPortal(agencyId: string) {
  const o = await owned(agencyId);
  const row = await paymentRow(o);
  if (!row?.customer_id) redirect(billingPage(agencyId, "?error=portal"));
  const res = await billing().portalUrl(row.customer_id);
  if (!res.ok) redirect(billingPage(agencyId, "?error=portal"));
  redirect(res.data.url);
}

export async function switchToYearly(agencyId: string) {
  const o = await owned(agencyId);
  const row = await paymentRow(o);
  if (!row?.external_id || row.status !== "active" || row.billing_interval !== "month")
    redirect(billingPage(agencyId));
  const res = await billing().switchToYearly(row.external_id);
  // The webhook (subscription.update) records the new interval and period.
  redirect(billingPage(agencyId, res.ok ? "?status=switched" : "?error=switch"));
}

export async function keepPro(agencyId: string) {
  const o = await owned(agencyId);
  const row = await paymentRow(o);
  if (!row?.external_id || !row.cancel_at_period_end) redirect(billingPage(agencyId));
  const res = await billing().resume(row.external_id);
  redirect(billingPage(agencyId, res.ok ? "?status=resumed" : "?error=resume"));
}
