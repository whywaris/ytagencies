import "server-only";
import { cache } from "react";

import { entitlementsFor, type Entitlements, type Subscription } from "@/lib/entitlements";
import { createAdminClient } from "@/lib/supabase/admin";

// Plans, verifications and sponsored slots for public pages (ADMIN_V2_SPEC §6–7). Anon can't read
// these tables, so they're read here with the service role (read-only) and cached per render.
// Directory and profile pages are ISR, and admin changes revalidate the affected paths.

export type Slot = {
  serviceId: number;
  industryId: number | null;
  locationId: number | null;
  agencyId: string;
  position: number;
};

export const getPlacement = cache(async (now = new Date()) => {
  const db = createAdminClient();
  const iso = now.toISOString();
  const [subs, verifications, slots] = await Promise.all([
    db.from("agency_subscriptions").select("agency_id, plan_id, status, starts_at, ends_at"),
    db.from("verifications").select("agency_id, stats_snapshot").eq("status", "approved"),
    db
      .from("sponsored_slots")
      .select("service_id, industry_id, location_id, agency_id, position")
      .lte("starts_at", iso)
      .gt("ends_at", iso)
      .order("position"),
  ]);
  if (subs.error || verifications.error || slots.error) {
    throw new Error("Couldn't load plans and placements");
  }

  const subsByAgency = new Map<string, Subscription[]>();
  for (const s of subs.data) {
    const list = subsByAgency.get(s.agency_id) ?? [];
    list.push(s);
    subsByAgency.set(s.agency_id, list);
  }
  const verified = new Map<string, "approved" | "withStats">();
  for (const v of verifications.data) {
    if (verified.get(v.agency_id) !== "withStats") {
      verified.set(v.agency_id, v.stats_snapshot ? "withStats" : "approved");
    }
  }
  const entitlements = (agencyId: string): Entitlements =>
    entitlementsFor({
      subscriptions: subsByAgency.get(agencyId) ?? [],
      verificationApproved: verified.has(agencyId),
      now,
    });

  return {
    entitlements,
    verification: (agencyId: string) => verified.get(agencyId) ?? ("none" as const),
    /**
     * Active slot holders for a page, by position. Holders must still be eligible (paid plan and
     * the Verified badge, §5.8); a slot whose agency lapsed is skipped rather than shown.
     */
    sponsoredFor(page: { serviceId: number; industryId?: number; locationId?: number }) {
      return slots.data
        .filter(
          (s) =>
            s.service_id === page.serviceId &&
            s.industry_id === (page.industryId ?? null) &&
            s.location_id === (page.locationId ?? null),
        )
        .filter((s) => {
          const e = entitlements(s.agency_id);
          return e.canBuySponsored && e.verifiedBadge;
        })
        .map((s) => s.agency_id);
    },
  };
});

/** Plan prices for /for-agencies/pricing (plans is seeded and admin-write; anon can't read it). */
export const getPlanPrices = cache(async () => {
  const { data, error } = await createAdminClient()
    .from("plans")
    .select("id, name, price_monthly, price_yearly");
  if (error) throw new Error("Couldn't load plans");
  return new Map(data.map((p) => [p.id, p]));
});
