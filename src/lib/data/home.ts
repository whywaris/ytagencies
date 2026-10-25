import "server-only";
import { cache } from "react";

import { getAgencySlugs, getResponseTimes, listQuery, toListItem } from "@/lib/data/agencies";
import { profileViews } from "@/lib/data/agency-stats";
import { getPlacement } from "@/lib/data/placement";
import { getLocations, getServices } from "@/lib/data/taxonomy";
import { pickHomeAgencies, typicalStart } from "@/lib/home";

// Home page data, all live (the page is ISR, hourly). One read of the published agencies feeds
// the agency cards, the stats line and the services' typical starting prices.

const publishedRows = cache(async () => {
  const { data, error } = await listQuery();
  if (error) throw error;
  return data;
});

/** "Agencies to compare": lib/home.ts pickHomeAgencies (never empty while agencies are published). */
export const getHomeAgencies = cache(async () => {
  const [rows, slugs, placement, responses] = await Promise.all([
    publishedRows(),
    getAgencySlugs(),
    getPlacement(),
    getResponseTimes(),
  ]);
  const indexable = new Set(slugs.filter((s) => s.indexable).map((s) => s.slug));
  const views = await profileViews(rows.map((r) => r.id));
  return pickHomeAgencies(
    rows.map((r) => ({
      ...toListItem(r, placement, responses),
      indexable: indexable.has(r.slug),
      complete: !!r.logo_path && !!r.description?.trim() && r.agency_services.length >= 2,
    })),
    { sponsoredIds: placement.sponsoredAnywhere(), views: Object.fromEntries(views) },
  );
});

/** The hero's stats line: published agencies, services, and countries agencies are based in. */
export const getHomeStats = cache(async () => {
  const [rows, services, locations] = await Promise.all([
    publishedRows(),
    getServices(),
    getLocations(),
  ]);
  const byId = new Map(locations.map((l) => [l.id, l]));
  const countries = new Set<number>();
  for (const r of rows) {
    const hq = r.hq_location_id === null ? null : byId.get(r.hq_location_id);
    const country = hq?.type === "city" ? hq.parentId : hq?.id;
    if (country) countries.add(country);
  }
  return { agencies: rows.length, services: services.length, countries: countries.size };
});

/** Per service slug: the typical starting price (lib/home.ts typicalStart), or none. */
export const getServiceStartPrices = cache(async () => {
  const prices = new Map<string, { usd: number | null; model: string | null }[]>();
  for (const r of await publishedRows())
    for (const s of r.agency_services)
      prices.set(s.services.slug, [
        ...(prices.get(s.services.slug) ?? []),
        { usd: r.min_budget_usd, model: r.pricing_model },
      ]);
  return new Map([...prices].map(([slug, list]) => [slug, typicalStart(list)]));
});
