"use server";

import { redirect } from "next/navigation";

import { billing, checkoutAvailable, type Interval } from "@/lib/billing";
import { checkoutTarget } from "@/lib/billing/checkout";
import { reportCheckoutUnavailable } from "@/lib/billing/lemonsqueezy";
import { getOwnedAgency, getUser } from "@/lib/auth";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// Dashboard → Billing (Lemon Squeezy). Each action re-checks ownership: owner_id is only set after a
// verified claim or an approved submission (SECURITY.md). Called from plain <form action>s bound
// to (agencyId, …); failures come back to the Billing page as ?error=.

const billingPage = (slug: string, query = "") => `/dashboard/${slug}/billing${query}`;

async function owned(agencyId: string) {
  const o = await getOwnedAgency(agencyId);
  if (!o) redirect("/dashboard");
  return o;
}

/** The agency's latest paid subscription (owners read their own rows under RLS). */
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

/** The Billing page's and the claim flow's Get Pro buttons. */
export async function startCheckout(
  agencyId: string,
  interval: Interval,
  from: "billing" | "claim" = "billing",
) {
  if (interval !== "month" && interval !== "year") redirect("/dashboard");
  const o = await owned(agencyId);
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(billingPage(o.agency.slug))}`);
  redirect(await checkoutTarget(o, user.id, user.email ?? null, interval, from));
}

/**
 * "Subscribe now" when adding an agency: the submitter pays for their own draft before review, so
 * management starts as soon as it's approved. Only the submitter of an unowned draft. If the admin
 * rejects it, Admin → Submissions reminds them to refund and cancel it in Lemon Squeezy.
 */
export async function startSubmissionCheckout(agencyId: string, interval: Interval) {
  if (!/^[0-9a-f-]{36}$/i.test(agencyId) || (interval !== "month" && interval !== "year"))
    redirect("/dashboard");
  const user = await getUser();
  if (!user) redirect("/dashboard");
  if (!checkoutAvailable()) {
    await reportCheckoutUnavailable();
    redirect("/dashboard?status=checkout-failed");
  }
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
