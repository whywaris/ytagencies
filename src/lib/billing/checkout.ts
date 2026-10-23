import "server-only";

import { billing, checkoutAvailable, type Interval } from "@/lib/billing";
import { reportCheckoutUnavailable } from "@/lib/billing/lemonsqueezy";
import type { getOwnedAgency } from "@/lib/auth";
import { isManaged } from "@/lib/entitlements";
import { absoluteUrl } from "@/lib/site";

// Get Pro → Lemon Squeezy checkout. Not a server action: callers pass an agency they've already checked
// the user owns (lib/auth getOwnedAgency), never anything from the browser.

type Owned = NonNullable<Awaited<ReturnType<typeof getOwnedAgency>>>;

const billingPage = (slug: string, query = "") => `/dashboard/${slug}/billing${query}`;

/**
 * Where Get Pro sends an owner: the Lemon Squeezy checkout for the period (created server-side), the
 * Billing page when they're already on Pro, or the Billing page with "unavailable" when checkout
 * can't start (logged and emailed to the admin; never a form instead). `from` decides where Lemon Squeezy
 * sends the buyer back: Billing's success page, or the claim flow's welcome screen.
 */
export async function checkoutTarget(
  o: Owned,
  userId: string,
  email: string | null,
  interval: Interval,
  from: "billing" | "claim" = "billing",
) {
  const slug = o.agency.slug;
  // Already managed: nothing to buy (switching to yearly is its own button).
  const { data: subs } = await o.supabase
    .from("agency_subscriptions")
    .select("plan_id, status, starts_at, ends_at, cancel_at_period_end, past_due_since")
    .eq("agency_id", o.agency.id);
  if (isManaged(subs ?? [])) return billingPage(slug);

  if (!checkoutAvailable()) {
    await reportCheckoutUnavailable();
    return billingPage(slug, "?error=unavailable");
  }
  const res = await billing().createCheckout({
    agencyId: o.agency.id,
    userId,
    email,
    interval,
    successUrl: absoluteUrl(
      from === "claim" ? `/claim/${slug}?status=success` : `/dashboard/${slug}/billing/success`,
    ),
  });
  if (!res.ok) {
    await reportCheckoutUnavailable();
    return billingPage(slug, "?error=checkout");
  }
  return res.data.url;
}
