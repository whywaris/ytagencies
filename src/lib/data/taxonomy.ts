import "server-only";
import { cache } from "react";

import { createStaticClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

// Public taxonomy reads. Uses the cookie-less anon client so pages stay static (ISR).
// Wrapped in cache() so generateMetadata and the page share one query per request.

export type Service = { id: number; slug: string; name: string; intro: string | null };
export type Industry = Service;
export type Location = {
  id: number;
  slug: string;
  name: string;
  type: "country" | "city";
  parentId: number | null;
};

export type Segment =
  | { kind: "industry"; slug: string; industry: Industry }
  // locationIds = the location plus its cities, so /in-usa includes agencies in Austin.
  | { kind: "location"; slug: string; location: Location; locationIds: number[] };

export type Faq = { question: string; answer: string };

export const getServices = cache(async (): Promise<Service[]> => {
  const { data, error } = await createStaticClient()
    .from("services")
    .select("id, slug, name, intro")
    .order("sort_order");
  if (error) throw error;
  return data;
});

export const getServiceBySlug = cache(async (slug: string): Promise<Service | null> => {
  const services = await getServices();
  return services.find((s) => s.slug === slug) ?? null;
});

export const getIndustries = cache(async (): Promise<Industry[]> => {
  const { data, error } = await createStaticClient()
    .from("industries")
    .select("id, slug, name, intro")
    .order("sort_order");
  if (error) throw error;
  return data;
});

export const getIndustryBySlug = cache(async (slug: string): Promise<Industry | null> => {
  const industries = await getIndustries();
  return industries.find((i) => i.slug === slug) ?? null;
});

export const getLocations = cache(async (): Promise<Location[]> => {
  const { data, error } = await createStaticClient()
    .from("locations")
    .select("id, slug, name, type, parent_id")
    .order("name");
  if (error) throw error;
  return data.map((l) => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    type: l.type as Location["type"], // enforced by a check constraint
    parentId: l.parent_id,
  }));
});

export const getLocationBySlug = cache(async (slug: string): Promise<Location | null> => {
  const locations = await getLocations();
  return locations.find((l) => l.slug === slug) ?? null;
});

/** Resolves a `[segment]` param (`for-<industry>` | `in-<location>`). Null means notFound(). */
export const resolveSegment = cache(async (segment: string): Promise<Segment | null> => {
  if (segment.startsWith("for-")) {
    const slug = segment.slice(4);
    const industry = await getIndustryBySlug(slug);
    return industry ? { kind: "industry", slug, industry } : null;
  }
  if (segment.startsWith("in-")) {
    const slug = segment.slice(3);
    const locations = await getLocations();
    const location = locations.find((l) => l.slug === slug);
    if (!location) return null;
    const locationIds = [
      location.id,
      ...locations.filter((l) => l.parentId === location.id).map((l) => l.id),
    ];
    return { kind: "location", slug, location, locationIds };
  }
  return null;
});

/** Unique copy for a service × industry page. Null when none has been written yet. */
export const getComboContent = cache(async (serviceId: number, industryId: number) => {
  const { data, error } = await createStaticClient()
    .from("service_industry_content")
    .select("intro, how_to_choose, faqs")
    .eq("service_id", serviceId)
    .eq("industry_id", industryId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { intro: data.intro, howToChoose: data.how_to_choose, faqs: toFaqs(data.faqs) };
});

function toFaqs(json: Json | null): Faq[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (f): f is Faq =>
      typeof f === "object" &&
      f !== null &&
      !Array.isArray(f) &&
      typeof f.question === "string" &&
      typeof f.answer === "string",
  );
}
