import "server-only";

import type { AuthorOption, EditorGuide } from "@/components/admin/guide-editor";
import { emptyDoc, guideDoc } from "@/lib/guide-content";
import { createAdminClient } from "@/lib/supabase/admin";

// Editor helpers for the Guides CMS (ADMIN_V2_SPEC §8).

/** Authors for the editor's picker, by name. */
export async function authorOptions(): Promise<AuthorOption[]> {
  const { data, error } = await createAdminClient()
    .from("authors")
    .select("id, name")
    .order("name");
  if (error) throw new Error("Couldn't load authors");
  return data;
}

type Row = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  body_json: unknown;
  draft_json: unknown;
  draft_meta: unknown;
  draft_updated_at: string | null;
  cover_path: string | null;
  cover_alt: string | null;
  prices_checked_on: string | null;
  seo_title: string | null;
  seo_description: string | null;
  author_id: string | null;
  category_id: string | null;
  is_featured: boolean;
  related_combos: unknown;
  key_takeaways: string[];
  numbered_sections: boolean;
  status: string;
  published_at: string | null;
};

export function toEditorGuide(row: Row): EditorGuide {
  // Unpublished changes of a live guide sit on top of the live fields.
  const g: Row = { ...row, ...(row.draft_meta as Partial<Row> | null) };
  return {
    id: g.id,
    title: g.title,
    slug: g.slug,
    excerpt: g.excerpt ?? "",
    // Unpublished changes first; guides from before the Tiptap editor convert from Markdown.
    body: guideDoc(g.draft_json ?? g.body_json, g.body_md),
    coverPath: g.cover_path,
    coverAlt: g.cover_alt ?? "",
    pricesCheckedOn: g.prices_checked_on ?? "",
    seoTitle: g.seo_title ?? "",
    seoDescription: g.seo_description ?? "",
    authorId: g.author_id,
    categoryId: g.category_id,
    isFeatured: row.is_featured,
    related: Array.isArray(g.related_combos) ? (g.related_combos as EditorGuide["related"]) : [],
    keyTakeaways: g.key_takeaways,
    numberedSections: g.numbered_sections,
    status: (["draft", "scheduled", "published"].includes(g.status)
      ? g.status
      : "draft") as EditorGuide["status"],
    publishedAt: g.published_at,
    slugLocked: !!g.published_at && new Date(g.published_at) <= new Date(),
    hasDraft: !!g.draft_updated_at,
  };
}

export const NEW_GUIDE: EditorGuide = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  body: emptyDoc(),
  coverPath: null,
  coverAlt: "",
  pricesCheckedOn: "",
  seoTitle: "",
  seoDescription: "",
  authorId: null,
  categoryId: null,
  isFeatured: false,
  related: [],
  keyTakeaways: [],
  numberedSections: false,
  status: "draft",
  publishedAt: null,
  slugLocked: false,
  hasDraft: false,
};


/** Guide categories for the editor's Category select, in order. */
export async function categoryOptions(): Promise<{ id: string; name: string; slug: string }[]> {
  const { data, error } = await createAdminClient()
    .from("guide_categories")
    .select("id, name, slug")
    .order("sort_order")
    .order("name");
  if (error) throw new Error("Couldn't load categories");
  return data;
}
