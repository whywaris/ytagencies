import "server-only";
import { cache } from "react";

import { guideMatches } from "@/lib/guide-categories";
import { docReadMinutes, guideDoc, type Doc } from "@/lib/guide-content";
import { createStaticClient } from "@/lib/supabase/server";

// Public guide and author reads. Anon client: RLS returns only live guides (published, or
// scheduled with published_at passed) and only authors with a live guide; the explicit filters
// are a second guard. user_id on authors isn't readable by anon at all (column grants).

const LIVE_STATUSES = ["published", "scheduled"];
export const AUTHOR_COLUMNS =
  "slug, name, role, bio, avatar_path, linkedin_url, x_url, website_url";
const SUMMARY_COLUMNS = `slug, title, excerpt, seo_description, category_id, is_featured, published_at, updated_at, content_updated_at, cover_path, cover_alt, body_md, body_json, author:authors(${AUTHOR_COLUMNS})`;

export { mediaUrl } from "@/lib/guide-media";

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

export type GuideSummary = {
  slug: string;
  title: string;
  excerpt: string | null;
  description: string;
  publishedAt: string;
  updatedAt: string;
  coverPath: string | null;
  /** The cover's alt text, set in the editor (empty: cards use the title). */
  coverAlt: string | null;
  readMinutes: number;
  author: Author | null;
  categoryId: string | null;
  isFeatured: boolean;
};

type SummaryRow = {
  slug: string;
  category_id: string | null;
  is_featured: boolean;
  title: string;
  excerpt: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
  content_updated_at: string | null;
  cover_path: string | null;
  cover_alt: string | null;
  body_md: string;
  body_json: unknown;
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
    coverAlt: g.cover_alt,
    readMinutes: docReadMinutes(guideDoc(g.body_json, g.body_md)),
    author: toAuthor(g.author),
    categoryId: g.category_id,
    isFeatured: g.is_featured,
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
    .select(
      `${SUMMARY_COLUMNS}, seo_title, key_takeaways, numbered_sections, prices_checked_on`,
    )
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
    cover_alt: string | null;
    prices_checked_on: string | null;
  };
  return {
    ...summary(row),
    doc: guideDoc(row.body_json, row.body_md) as Doc,
    seoTitle: row.seo_title,
    keyTakeaways: row.key_takeaways,
    numberedSections: row.numbered_sections,
    coverAlt: row.cover_alt,
    pricesCheckedOn: row.prices_checked_on,
  };
});

/** Up to `n` other guides: the same category first (then newest), topped up with the latest. */
export async function relatedGuides(slug: string, categoryId: string | null, n = 3) {
  const others = (await getLiveGuides()).filter((g) => g.slug !== slug);
  return [
    ...others.filter((g) => categoryId && g.categoryId === categoryId),
    ...others.filter((g) => !categoryId || g.categoryId !== categoryId),
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

export type GuideCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  sort_order: number;
  show_in_tabs: boolean;
};

/** Every guide category (public read), in order. */
export const getGuideCategories = cache(async (): Promise<GuideCategory[]> => {
  const { data, error } = await createStaticClient()
    .from("guide_categories")
    .select("id, name, slug, description, color, sort_order, show_in_tabs")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data;
});

/** The category a slug moved away from (Admin → Guides → Categories, slug change). */
export const getCategoryRedirect = cache(async (slug: string) => {
  const { data } = await createStaticClient()
    .from("guide_category_redirects")
    .select("guide_categories(slug)")
    .eq("from_slug", slug)
    .maybeSingle();
  return (data?.guide_categories as { slug: string } | null)?.slug ?? null;
});

/** Slugs of live guides whose title, excerpt or body text match the search (cleanGuideQuery). */
export const searchLiveGuides = cache(async (q: string) => {
  const { data, error } = await createStaticClient()
    .from("guides")
    .select("slug, title, excerpt, body_html")
    .in("status", LIVE_STATUSES)
    .lte("published_at", new Date().toISOString());
  if (error) throw error;
  const text = (html: string | null) =>
    (html ?? "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  return new Set(
    data
      .filter((g) =>
        guideMatches({ title: g.title, excerpt: g.excerpt, text: text(g.body_html) }, q),
      )
      .map((g) => g.slug),
  );
});
