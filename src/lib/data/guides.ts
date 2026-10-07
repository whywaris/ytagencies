import "server-only";
import { cache } from "react";

import { getIndustries, getLocations, getServices } from "@/lib/data/taxonomy";
import { createStaticClient } from "@/lib/supabase/server";

// Public guide reads (ADMIN_V2_SPEC §8). Anon client: RLS returns only live guides (published, or
// scheduled with published_at passed); the explicit filters are a second guard.

const LIVE_STATUSES = ["published", "scheduled"];

export type GuideSummary = {
  slug: string;
  title: string;
  excerpt: string | null;
  description: string;
  publishedAt: string;
  updatedAt: string;
  coverPath: string | null;
};

export type RelatedCombo = { service_id: number; industry_id?: number; location_id?: number };

function summary(g: {
  slug: string;
  title: string;
  excerpt: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
  cover_path: string | null;
}): GuideSummary {
  return {
    slug: g.slug,
    title: g.title,
    excerpt: g.excerpt,
    description: g.seo_description || g.excerpt || g.title,
    publishedAt: g.published_at!,
    updatedAt: g.updated_at,
    coverPath: g.cover_path,
  };
}

export const getLiveGuides = cache(async (): Promise<GuideSummary[]> => {
  const { data, error } = await createStaticClient()
    .from("guides")
    .select("slug, title, excerpt, seo_description, published_at, updated_at, cover_path")
    .in("status", LIVE_STATUSES)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (error) throw error;
  return data.map(summary);
});

export const getGuideBySlug = cache(async (slug: string) => {
  const { data, error } = await createStaticClient()
    .from("guides")
    .select("*")
    .eq("slug", slug)
    .in("status", LIVE_STATUSES)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...summary(data),
    body: data.body_md,
    seoTitle: data.seo_title,
    author: data.author_name || "YT Agencies editorial team",
    related: await resolveCombos(data.related_combos),
  };
});

/** The current slug of a guide whose old slug is `slug` (only for live guides, via RLS). */
export const getGuideRedirect = cache(async (slug: string) => {
  const { data } = await createStaticClient()
    .from("guide_redirects")
    .select("guides(slug)")
    .eq("from_slug", slug)
    .maybeSingle();
  return data?.guides?.slug ?? null;
});

/** Related directory pages as links. Pages whose taxonomy entries were removed are skipped. */
export async function resolveCombos(raw: unknown) {
  const combos = Array.isArray(raw) ? (raw as RelatedCombo[]) : [];
  const [services, industries, locations] = await Promise.all([
    getServices(),
    getIndustries(),
    getLocations(),
  ]);
  return combos.flatMap((c) => {
    const s = services.find((x) => x.id === c.service_id);
    if (!s) return [];
    if (c.industry_id) {
      const i = industries.find((x) => x.id === c.industry_id);
      return i
        ? [{ href: `/${s.slug}/for-${i.slug}`, label: `${s.name} agencies for ${i.name}` }]
        : [];
    }
    if (c.location_id) {
      const l = locations.find((x) => x.id === c.location_id);
      return l
        ? [{ href: `/${s.slug}/in-${l.slug}`, label: `${s.name} agencies in ${l.name}` }]
        : [];
    }
    return [{ href: `/${s.slug}`, label: `Compare ${s.name} agencies` }];
  });
}
