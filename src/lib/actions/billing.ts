"use server";

import { redirect } from "next/navigation";

import { billing, checkoutAvailable, type Interval } from "@/lib/billing";
import { getOwnedAgency, getUser } from "@/lib/auth";
import { isManaged } from "@/lib/entitlements";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// Dashboard → Billing (Creem). Each action re-checks ownership: owner_id is only set after a
// verified claim or an approved submission (SECURITY.md). Called from plain <form action>s bound
// to (agencyId, …); failures come back to the Billing page as ?error=.

const billingPage = (slug: string, query = "") => `/dashboard/${slug}/billing${query}`;

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

/**
 * Starts a Creem checkout for Pro. `from` decides where Creem sends the buyer back: the Billing
 * page, the claim flow's welcome screen, or the dashboard after adding a new agency.
 */
export async function startCheckout(
  agencyId: string,
  interval: Interval,
  from: "billing" | "claim" = "billing",
) {
  if (interval !== "month" && interval !== "year") redirect("/dashboard");
  const o = await owned(agencyId);
  const user = await getUser();
  if (!user || !checkoutAvailable()) redirect(billingPage(o.agency.slug, "?error=unavailable"));

  // Already managed: nothing to buy (switching to yearly is its own button).
  const { data: subs } = await o.supabase
    .from("agency_subscriptions")
    .select("plan_id, status, starts_at, ends_at, cancel_at_period_end, past_due_since")
    .eq("agency_id", o.agency.id);
  if (isManaged(subs ?? [])) redirect(billingPage(o.agency.slug));

  const res = await billing().createCheckout({
    agencyId: o.agency.id,
    userId: user.id,
    email: user.email ?? null,
    interval,
    successUrl: absoluteUrl(
      from === "claim"
        ? `/claim/${o.agency.slug}?status=success`
        : billingPage(o.agency.slug, "?status=success"),
    ),
  });
  if (!res.ok) redirect(billingPage(o.agency.slug, "?error=checkout"));
  redirect(res.data.url);
}

/**
 * "Subscribe now" when adding an agency: the submitter pays for their own draft before review, so
 * management starts as soon as it's approved. Only the submitter of an unowned draft. If the admin
 * rejects it, Admin → Submissions reminds them to refund and cancel it in Creem.
 */
export async function startSubmissionCheckout(agencyId: string, interval: Interval) {
  if (!/^[0-9a-f-]{36}$/i.test(agencyId) || (interval !== "month" && interval !== "year"))
    redirect("/dashboard");
  const user = await getUser();
  if (!user || !checkoutAvailable()) redirect("/dashboard");
  const { data: draft } = await createAdminClient()
    .from("agencies")
    .select("id")
    .eq("id", agencyId)
    .eq("submitted_by", user.id)
    .eq("status", "draft")
    .is("owner_id", null)
    .maybeSingle();
  if (!draft) redirect("/dashboard");
  const res = await billing().createCheckout({
    agencyId: draft.id,
    userId: user.id,
    email: user.email ?? null,
    interval,
    successUrl: absoluteUrl("/dashboard?status=subscribed"),
  });
  redirect(res.ok ? res.data.url : "/dashboard?status=checkout-failed");
}

export async function openBillingPortal(agencyId: string) {
  const o = await owned(agencyId);
  const row = await paymentRow(o);
  if (!row?.customer_id) redirect(billingPage(o.agency.slug, "?error=portal"));
  const res = await billing().portalUrl(row.customer_id);
  if (!res.ok) redirect(billingPage(o.agency.slug, "?error=portal"));
  redirect(res.data.url);
}

export async function switchToYearly(agencyId: string) {
  const o = await owned(agencyId);
  const row = await paymentRow(o);
  if (!row?.external_id || row.status !== "active" || row.billing_interval !== "month")
    redirect(billingPage(o.agency.slug));
  const res = await billing().switchToYearly(row.external_id);
  // The webhook (subscription.update) records the new interval and period.
  redirect(billingPage(o.agency.slug, res.ok ? "?status=switched" : "?error=switch"));
}

export async function keepPro(agencyId: string) {
  const o = await owned(agencyId);
  const row = await paymentRow(o);
  if (!row?.external_id || !row.cancel_at_period_end) redirect(billingPage(o.agency.slug));
  const res = await billing().resume(row.external_id);
  redirect(billingPage(o.agency.slug, res.ok ? "?status=resumed" : "?error=resume"));
}
