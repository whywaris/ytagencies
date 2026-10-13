import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";

import { getProPrices } from "@/components/plan-columns";
import { getOwnedAgencyBySlug } from "@/lib/auth";
import { checkoutAvailable } from "@/lib/billing";
import { getEntitlements } from "@/lib/data/entitlements";
import { liveSubscription } from "@/lib/entitlements";
import { absoluteUrl } from "@/lib/site";
import { yearlySaving } from "@/lib/pricing";

/**
 * Everything every dashboard page needs: the owned agency, found by its slug (/dashboard/<slug>)
 * and still checked against owner_id (404 otherwise: someone else's slug confirms nothing), what it's entitled to, its plan and the Pro prices. Cached, so the
 * layout and the page share one lookup.
 */
export const dashboardContext = cache(async (slug: string) => {
  const owned = await getOwnedAgencyBySlug(slug);
  if (!owned) notFound();
  const { agency, supabase } = owned;
  const [e, subs, prices] = await Promise.all([
    getEntitlements(agency.id),
    supabase
      .from("agency_subscriptions")
      .select(
        "plan_id, status, starts_at, ends_at, cancel_at_period_end, past_due_since, source, billing_interval, customer_id",
      )
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false }),
    getProPrices(),
  ]);
  if (subs.error) throw new Error("Couldn't load your plan");
  return {
    agency,
    supabase,
    e,
    live: liveSubscription(subs.data),
    /** Had Pro before (now ended). */
    lapsed: !e.managed && subs.data.length > 0,
    /** When the latest Pro ended (lapsed only; null if it ended without a date). */
    endedAt: !e.managed ? (subs.data[0]?.ends_at ?? null) : null,
    pro: {
      ...prices,
      saving: yearlySaving(prices.monthly, prices.yearly),
      checkout: checkoutAvailable(),
      agencyUrl: absoluteUrl(`/agency/${agency.slug}`),
    },
  };
});
export type DashboardContext = Awaited<ReturnType<typeof dashboardContext>>;
