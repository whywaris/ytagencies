import "server-only";
import { cache } from "react";

import { docReadMinutes, guideDoc, type Doc } from "@/lib/guide-content";
import { getIndustries, getLocations, getServices } from "@/lib/data/taxonomy";
import { createStaticClient } from "@/lib/supabase/server";

// Public guide and author reads. Anon client: RLS returns only live guides (published, or
// scheduled with published_at passed) and only authors with a live guide; the explicit filters
// are a second guard. user_id on authors isn't readable by anon at all (column grants).

const LIVE_STATUSES = ["published", "scheduled"];
export const AUTHOR_COLUMNS =
  "slug, name, role, bio, avatar_path, linkedin_url, x_url, website_url";
const SUMMARY_COLUMNS = `slug, title, excerpt, seo_description, published_at, updated_at, content_updated_at, cover_path, body_md, body_json, related_combos, author:authors(${AUTHOR_COLUMNS})`;

/**
 * Public URL of an image: a pasted https link (covers hosted on Cloudflare, see lib/media.ts) as
 * it is, else a file in the agency-media bucket (older uploads, guide images, author photos).
 */
export const mediaUrl = (path: string) =>
  path.startsWith("https://")
    ? path
    : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/agency-media/${path}`;

export type Author = {
  slug: string;
  name: string;
  role: string | null;
  bio: string | null;
  avatarPath: string | null;
  links: { label: "LinkedIn" | "X" | "Website"; href: string }[];
};

export type AuthorRow = {
  slug: string;
  name: string;
  role: string | null;
  bio: string | null;
  avatar_path: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  website_url: string | null;
};

export function toAuthor(a: AuthorRow | null): Author | null {
  if (!a) return null;
  const links: Author["links"] = [];
  if (a.linkedin_url) links.push({ label: "LinkedIn", href: a.linkedin_url });
  if (a.x_url) links.push({ label: "X", href: a.x_url });
  if (a.website_url) links.push({ label: "Website", href: a.website_url });
  return {
    slug: a.slug,
    name: a.name,
    role: a.role,
    bio: a.bio,
    avatarPath: a.avatar_path,
    links,
  };
}

export type RelatedCombo = { service_id: number; industry_id?: number; location_id?: number };

const combosOf = (raw: unknown) => (Array.isArray(raw) ? (raw as RelatedCombo[]) : []);

export type GuideSummary = {
  slug: string;
  title: string;
  excerpt: string | null;
  description: string;
  publishedAt: string;
  updatedAt: string;
  coverPath: string | null;
  readMinutes: number;
  author: Author | null;
  /** Services of its related directory pages: for filters and related guides. */
  serviceIds: number[];
  /** Its related directory pages: directory pages link back to it. */
  combos: RelatedCombo[];
};

type SummaryRow = {
  slug: string;
  title: string;
  excerpt: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
  content_updated_at: string | null;
  cover_path: string | null;
  body_md: string;
  body_json: unknown;
  related_combos: unknown;
  author: AuthorRow | null;
};

function summary(g: SummaryRow): GuideSummary {
  return {
    slug: g.slug,
    title: g.title,
    excerpt: g.excerpt,
    description: g.seo_description || g.excerpt || g.title,
    publishedAt: g.published_at!,
    // The last published change to the content (not every save of a draft).
    updatedAt: g.content_updated_at ?? g.published_at ?? g.updated_at,
    coverPath: g.cover_path,
    readMinutes: docReadMinutes(guideDoc(g.body_json, g.body_md)),
    author: toAuthor(g.author),
    serviceIds: [...new Set(combosOf(g.related_combos).map((c) => c.service_id))],
    combos: combosOf(g.related_combos),
  };
}

// ponytail: loads every live guide's body for read times; store a word count if guides number
// in the hundreds.
export const getLiveGuides = cache(async (): Promise<GuideSummary[]> => {
  const { data, error } = await createStaticClient()
    .from("guides")
    .select(SUMMARY_COLUMNS)
    .in("status", LIVE_STATUSES)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data as SummaryRow[]).map(summary);
});

export const getGuideBySlug = cache(async (slug: string) => {
  const { data, error } = await createStaticClient()
    .from("guides")
    .select(`${SUMMARY_COLUMNS}, seo_title, key_takeaways, numbered_sections`)
    .eq("slug", slug)
    .in("status", LIVE_STATUSES)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as SummaryRow & {
    seo_title: string | null;
    key_takeaways: string[];
    numbered_sections: boolean;
  };
  return {
    ...summary(row),
    doc: guideDoc(row.body_json, row.body_md) as Doc,
    seoTitle: row.seo_title,
    keyTakeaways: row.key_takeaways,
    numberedSections: row.numbered_sections,
    related: await resolveCombos(row.related_combos),
  };
});

/** Up to `n` other guides: most shared services first (then newest), topped up with the latest. */
export async function relatedGuides(slug: string, serviceIds: number[], n = 3) {
  const others = (await getLiveGuides()).filter((g) => g.slug !== slug);
  const shared = (g: GuideSummary) => g.serviceIds.filter((id) => serviceIds.includes(id)).length;
  return others
    .map((g, i) => ({ g, score: shared(g), i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, n)
    .map((x) => x.g);
}

/**
 * Up to `n` guides for a directory page: those that list this exact page among their related
 * directory pages first, then guides for the same service. Newest first within each.
 */
export async function guidesForPage(
  page: { serviceId: number; industryId?: number; locationId?: number },
  n = 3,
) {
  const exact = (g: GuideSummary) =>
    g.combos.some(
      (c) =>
        c.service_id === page.serviceId &&
        (c.industry_id ?? undefined) === page.industryId &&
        (c.location_id ?? undefined) === page.locationId,
    );
  const guides = await getLiveGuides();
  return [
    ...guides.filter(exact),
    ...guides.filter((g) => !exact(g) && g.serviceIds.includes(page.serviceId)),
  ].slice(0, n);
}

/** The current slug of a guide whose old slug is `slug` (only for live guides, via RLS). */
export const getGuideRedirect = cache(async (slug: string) => {
  const { data } = await createStaticClient()
    .from("guide_redirects")
    .select("guides(slug)")
    .eq("from_slug", slug)
    .maybeSingle();
  return data?.guides?.slug ?? null;
});

/** Authors with at least one live guide (RLS), for static params and the sitemap. */
export const getLiveAuthors = cache(async () => {
  const { data, error } = await createStaticClient()
    .from("authors")
    .select("slug, name, role, updated_at")
    .order("name");
  if (error) throw error;
  return data;
});

/** An author with their live guides, or null (unknown, or no live guide: RLS hides them). */
export const getAuthorBySlug = cache(async (slug: string) => {
  const { data, error } = await createStaticClient()
    .from("authors")
    .select(`${AUTHOR_COLUMNS}, updated_at`)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const guides = (await getLiveGuides()).filter((g) => g.author?.slug === slug);
  if (!guides.length) return null;
  return { ...toAuthor(data)!, updatedAt: data.updated_at, guides };
});

/** Related directory pages as links. Pages whose taxonomy entries were removed are skipped. */
export async function resolveCombos(raw: unknown) {
  const combos = combosOf(raw);
  const [services, industries, locations] = await Promise.all([
    getServices(),
    getIndustries(),
    getLocations(),
  ]);
  return combos.flatMap((c) => {
    const s = services.find((x) => x.id === c.service_id);
    if (!s) return [];
    const service = { slug: s.slug, name: s.name };
    if (c.industry_id) {
      const i = industries.find((x) => x.id === c.industry_id);
      return i
        ? [{ href: `/${s.slug}/for-${i.slug}`, label: `${s.name} agencies for ${i.name}`, service }]
        : [];
    }
    if (c.location_id) {
      const l = locations.find((x) => x.id === c.location_id);
      return l
        ? [{ href: `/${s.slug}/in-${l.slug}`, label: `${s.name} agencies in ${l.name}`, service }]
        : [];
    }
    return [{ href: `/${s.slug}`, label: `Compare ${s.name} agencies`, service }];
  });
}
