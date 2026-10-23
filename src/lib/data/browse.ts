import "server-only";
import { unstable_cache } from "next/cache";

import { prefixQuery, type BrowseOptions } from "@/lib/browse";
import { getResponseTimes, listQuery, toListItem, type AgencyListItem } from "@/lib/data/agencies";
import { getPlacement } from "@/lib/data/placement";
import { getIndustries, getLocations, getServices } from "@/lib/data/taxonomy";
import { rankAgencies } from "@/lib/ranking";
import { createStaticClient } from "@/lib/supabase/server";

// /agencies data. Every published agency in the shared ranking order (no sponsored slots here),
// cached 60 seconds: filtering, sorting and paging happen on that list per request
// (lib/browse.ts), so each URL is cheap and nothing per-user is cached. Search hits are cached
// per query for the same 60 seconds.

export type BrowseItem = AgencyListItem & { countries: string[] };

// ponytail: the whole published list per minute, capped at PostgREST's max rows (1000 by
// default). Page in SQL when the directory grows past that.
const loadPool = unstable_cache(
  async () => {
    const [{ data, error }, placement, responses, locations] = await Promise.all([
      listQuery(),
      getPlacement(),
      getResponseTimes(),
      getLocations(),
    ]);
    if (error) throw error;
    const byId = new Map(locations.map((l) => [l.id, l]));
    // A city counts for its country, the same as the directory's location pages.
    const countryOf = (id: number) => {
      const l = byId.get(id);
      const top = l?.parentId ? byId.get(l.parentId) : l;
      return top?.type === "country" ? top.slug : null;
    };
    const ranked = rankAgencies(
      data.map((row) => toListItem(row, placement, responses)),
      [],
      false,
    );
    return ranked.map((a): BrowseItem => ({
      ...a,
      countries: [...new Set(a.locationIds.map(countryOf).filter((c): c is string => c !== null))],
    }));
  },
  ["browse-pool"],
  { revalidate: 60 },
);

export const getBrowsePool = loadPool;

/** Ids of published agencies whose `search` tsvector (name, tagline, description) matches. */
export const searchAgencyIds = unstable_cache(
  async (q: string) => {
    const query = prefixQuery(q);
    if (!query) return [] as string[];
    const { data, error } = await createStaticClient()
      .from("agencies")
      .select("id")
      .eq("status", "published")
      .textSearch("search", query, { config: "english" });
    if (error) throw error;
    return data.map((r) => r.id);
  },
  ["browse-search"],
  { revalidate: 60 },
);

/** Filter choices from the database, plus the pricing models and team sizes that exist. */
export async function getBrowseOptions(pool: BrowseItem[]) {
  const [services, industries, locations] = await Promise.all([
    getServices(),
    getIndustries(),
    getLocations(),
  ]);
  const present = (pick: (a: BrowseItem) => string | null) =>
    [...new Set(pool.map(pick).filter((v): v is string => !!v))].sort();
  const countries = locations.filter((l) => l.type === "country");
  const options: BrowseOptions = {
    services: services.map((s) => s.slug),
    industries: industries.map((i) => i.slug),
    countries: countries.map((c) => c.slug),
    pricing: present((a) => a.pricingModel),
    teams: present((a) => a.teamSize),
  };
  return { options, services, industries, countries };
}
