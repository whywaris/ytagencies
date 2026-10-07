import "server-only";

import type { ComboOption, EditorGuide } from "@/components/admin/guide-editor";
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

type Row = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  cover_path: string | null;
  seo_title: string | null;
  seo_description: string | null;
  author_name: string | null;
  related_combos: unknown;
  status: string;
  published_at: string | null;
};

export function toEditorGuide(g: Row): EditorGuide {
  return {
    id: g.id,
    title: g.title,
    slug: g.slug,
    excerpt: g.excerpt ?? "",
    body: g.body_md,
    coverPath: g.cover_path,
    seoTitle: g.seo_title ?? "",
    seoDescription: g.seo_description ?? "",
    author: g.author_name ?? "",
    related: Array.isArray(g.related_combos) ? (g.related_combos as EditorGuide["related"]) : [],
    status: (["draft", "scheduled", "published"].includes(g.status)
      ? g.status
      : "draft") as EditorGuide["status"],
    publishedAt: g.published_at,
    slugLocked: !!g.published_at && new Date(g.published_at) <= new Date(),
  };
}

export const NEW_GUIDE: EditorGuide = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  coverPath: null,
  seoTitle: "",
  seoDescription: "",
  author: "",
  related: [],
  status: "draft",
  publishedAt: null,
  slugLocked: false,
};
