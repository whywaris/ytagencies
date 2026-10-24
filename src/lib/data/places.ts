import "server-only";
import { cache } from "react";

import { getBrowsePool, type BrowseItem } from "@/lib/data/browse";
import { getLocations, type Location } from "@/lib/data/taxonomy";
import { splitByPlace } from "@/lib/locations";
import { createStaticClient } from "@/lib/supabase/server";

// Worldwide pages (industry hubs, location hubs, service × location, service × industry ×
// country): agencies from the published list in the shared ranking order, the place they're
// about, and the admin's copy for the page (page_content) if any.

/** The admin's summary and intro for a page path; null until written. */
export const getPageContent = cache(async (path: string) => {
  const { data, error } = await createStaticClient()
    .from("page_content")
    .select("summary, intro, updated_at")
    .eq("path", path)
    .maybeSingle();
  if (error) throw error;
  return data && (data.summary || data.intro)
    ? { summary: data.summary, intro: data.intro, updatedAt: data.updated_at }
    : null;
});

export type Place = {
  country: Location;
  city: Location | null;
  /** The place and, for a country, all its cities. */
  ids: Set<number>;
  name: string;
};

/** A country, or a city in that country; null when it doesn't exist (or the pair doesn't match). */
export const getPlace = cache(async (countrySlug: string, citySlug?: string) => {
  const locations = await getLocations();
  const country = locations.find((l) => l.slug === countrySlug && l.type === "country");
  if (!country) return null;
  if (citySlug === undefined) {
    const ids = new Set([
      country.id,
      ...locations.filter((l) => l.parentId === country.id).map((l) => l.id),
    ]);
    return { country, city: null, ids, name: country.name } satisfies Place;
  }
  const city = locations.find((l) => l.slug === citySlug && l.parentId === country.id);
  return city
    ? ({ country, city, ids: new Set([city.id]), name: city.name } satisfies Place)
    : null;
});

/** A location's place from its slug alone (country or city), for /<service>/in-<slug>. */
export const getPlaceBySlug = cache(async (slug: string) => {
  const locations = await getLocations();
  const l = locations.find((x) => x.slug === slug);
  if (!l) return null;
  if (l.type === "country") return getPlace(l.slug);
  const country = locations.find((x) => x.id === l.parentId);
  return country ? getPlace(country.slug, l.slug) : null;
});

/** Agencies on a place's page, optionally for one service and/or industry: based there, then remote. */
export async function agenciesForPlace(
  place: Place,
  filter: { service?: string; industry?: string } = {},
) {
  const pool = await getBrowsePool();
  return splitByPlace(matching(pool, filter), place.ids);
}

/** Agencies offering a service and/or working in an industry, in ranking order. */
export async function agenciesFor(filter: { service?: string; industry?: string }) {
  return matching(await getBrowsePool(), filter);
}

const matching = (pool: BrowseItem[], f: { service?: string; industry?: string }) =>
  pool.filter(
    (a) =>
      (!f.service || a.services.some((s) => s.slug === f.service)) &&
      (!f.industry || a.industries.some((i) => i.slug === f.industry)),
  );
