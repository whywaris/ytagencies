import "server-only";

import { citySlug, cleanCityName, slugify } from "@/lib/locations";
import { createAdminClient } from "@/lib/supabase/admin";

// An agency's places from the owner or admin form: the HQ (a country, or a city in it created on
// demand the first time an agency names it) and the countries it serves remotely. Cities are never
// pre-generated; a city page only exists once agencies are on it. Callers check ownership (or the
// admin role) first; city rows are written with the service role because only admins can write
// locations.

export type PlacesInput = {
  hqCountry: string;
  hqCity: string;
  serves: string[];
};

type Resolved =
  | { ok: true; hqLocationId: number | null; servedIds: number[] }
  | { ok: false; field: "hqCountry" | "hqCity" | "serves"; error: string };

export async function resolvePlaces(input: PlacesInput): Promise<Resolved> {
  const db = createAdminClient();
  const slugs = [...new Set([input.hqCountry, ...input.serves].filter(Boolean))];
  const { data: countries, error } = slugs.length
    ? await db
        .from("locations")
        .select("id, slug, iso_code")
        .eq("type", "country")
        .in("slug", slugs)
    : { data: [], error: null };
  if (error)
    return { ok: false, field: "hqCountry", error: "Something went wrong. Please try again." };
  const bySlug = new Map(countries.map((c) => [c.slug, c]));
  if (input.serves.some((s) => !bySlug.has(s)))
    return {
      ok: false,
      field: "serves",
      error: "Some countries no longer exist. Reload the page.",
    };
  const servedIds = input.serves.map((s) => bySlug.get(s)!.id);

  if (!input.hqCountry) {
    if (input.hqCity.trim())
      return { ok: false, field: "hqCountry", error: "Choose the country your city is in." };
    return { ok: true, hqLocationId: null, servedIds };
  }
  const country = bySlug.get(input.hqCountry);
  if (!country) return { ok: false, field: "hqCountry", error: "Choose a country from the list." };
  if (!input.hqCity.trim()) return { ok: true, hqLocationId: country.id, servedIds };

  const name = cleanCityName(input.hqCity);
  if (!name) return { ok: false, field: "hqCity", error: "Enter the city's name (letters only)." };
  const cityId = await findOrCreateCity(db, country, name);
  if (!cityId)
    return { ok: false, field: "hqCity", error: "We couldn't save that city. Please try again." };
  return { ok: true, hqLocationId: cityId, servedIds };
}

type Db = ReturnType<typeof createAdminClient>;

async function findOrCreateCity(
  db: Db,
  country: { id: number; iso_code: string | null; slug: string },
  name: string,
) {
  const find = () =>
    db
      .from("locations")
      .select("id")
      .eq("type", "city")
      .eq("parent_id", country.id)
      .ilike("name", name.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
  const existing = await find();
  if (existing.data) return existing.data.id;

  // Slugs are global (/<service>/in-<city>): read the ones that could clash.
  const { data: taken } = await db
    .from("locations")
    .select("slug")
    .like("slug", `${slugify(name)}%`);
  const slug = citySlug(
    name,
    country.iso_code ?? country.slug.slice(0, 2),
    new Set(taken?.map((t) => t.slug)),
  );
  if (!slug) return null;
  const { data, error } = await db
    .from("locations")
    .insert({ slug, name, type: "city", parent_id: country.id })
    .select("id")
    .single();
  if (!error) return data.id;
  // Someone else created it at the same moment (one city per name per country).
  return (await find()).data?.id ?? null;
}
