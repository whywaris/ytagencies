import "server-only";

import type { AuthorOption, ComboOption, EditorGuide } from "@/components/admin/guide-editor";
import type { ServiceOption } from "@/components/admin/rich-editor";
import { emptyDoc, guideDoc } from "@/lib/guide-content";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIndustries, getLocations, getServices } from "@/lib/data/taxonomy";

// Editor helpers for the Guides CMS (ADMIN_V2_SPEC §8).

/** Every directory page a guide can link to: service hubs, × industry, × location. */
export async function comboOptions(): Promise<ComboOption[]> {
  const [services, industries, locations] = await Promise.all([
    getServices(),
    getIndustries(),
    getLocations(),
  ]);
  return services.flatMap((s) => [
    { key: `${s.id}:0:0`, label: `${s.name} (all)`, combo: { service_id: s.id } },
    ...industries.map((i) => ({
      key: `${s.id}:${i.id}:0`,
      label: `${s.name} for ${i.name}`,
      combo: { service_id: s.id, industry_id: i.id },
    })),
    ...locations.map((l) => ({
      key: `${s.id}:0:${l.id}`,
      label: `${s.name} in ${l.name}`,
      combo: { service_id: s.id, location_id: l.id },
    })),
  ]);
}

/** Services for the budget range block. */
export async function serviceOptions(): Promise<ServiceOption[]> {
  return (await getServices()).map((s) => ({ slug: s.slug, name: s.name }));
}

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
export async function categoryOptions(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await createAdminClient()
    .from("guide_categories")
    .select("id, name")
    .order("sort_order")
    .order("name");
  if (error) throw new Error("Couldn't load categories");
  return data;
}
