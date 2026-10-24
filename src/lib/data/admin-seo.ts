import "server-only";

import { getDirectoryIndex } from "@/lib/data/agencies";
import { getIndustries, getLocations, getServices } from "@/lib/data/taxonomy";
import { MIN_AGENCIES_TO_INDEX } from "@/lib/site";
import { pageTypeOf, type PageType } from "@/lib/sitemap-core";
import { createAdminClient } from "@/lib/supabase/admin";

// SEO pages health (ADMIN_V2_SPEC §5.6): every directory page that has agencies, of every type
// (service and industry hubs, country and city hubs, service × industry, service × location,
// service × industry × country), plus every service × industry page so its copy can be written
// ahead. Counts come from the same index as the sitemap, so they can't disagree with it. Leads
// only record a service and industry, so other types show leads as not tracked.

export type SeoPage = {
  key: string;
  type: PageType;
  label: string; // "YouTube Ads for Dentists", "Agencies in United States"
  path: string;
  agencies: number;
  indexed: boolean;
  /** Written copy: service × industry needs intro, how to choose and FAQs; others an intro. */
  copy: "complete" | "missing";
  leads30d: number | null;
  lastUpdated: string | null;
  editHref: string;
};

const PAGE = 1000;

/** SEO.md: unique intro, an industry-specific "how to choose", and 3–5 FAQs. */
function copyComplete(row: { intro: string | null; how_to_choose: string | null; faqs: unknown }) {
  return (
    !!row.intro?.trim() &&
    !!row.how_to_choose?.trim() &&
    Array.isArray(row.faqs) &&
    row.faqs.length >= 3
  );
}

export async function getSeoPages(now = new Date()) {
  const db = createAdminClient();
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const leads: { service_id: number | null; industry_id: number | null }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("leads")
      .select("service_id, industry_id")
      .gte("created_at", since)
      .not("service_id", "is", null)
      .not("industry_id", "is", null)
      .order("created_at")
      .range(from, from + PAGE - 1);
    if (error) throw new Error("Couldn't load leads");
    leads.push(...data);
    if (data.length < PAGE) break;
  }
  const [services, industries, locations, directory, content, written] = await Promise.all([
    getServices(),
    getIndustries(),
    getLocations(),
    getDirectoryIndex(),
    db
      .from("service_industry_content")
      .select("service_id, industry_id, intro, how_to_choose, faqs, updated_at"),
    db.from("page_content").select("path, intro, updated_at"),
  ]);
  if (content.error || written.error) throw new Error("Couldn't load page copy");

  const copy = new Map(content.data.map((c) => [`${c.service_id}|${c.industry_id}`, c]));
  const pageCopy = new Map(written.data.map((c) => [c.path, c]));
  const leadCount = new Map<string, number>();
  for (const l of leads) {
    const k = `${l.service_id}|${l.industry_id}`;
    leadCount.set(k, (leadCount.get(k) ?? 0) + 1);
  }
  const newest = (a: string | null | undefined, b: string | null | undefined) =>
    !a ? (b ?? null) : !b ? a : a > b ? a : b;
  const service = new Map(services.map((x) => [x.slug, x]));
  const industry = new Map(industries.map((x) => [x.slug, x]));
  const place = new Map(locations.map((x) => [x.slug, x.name]));

  const row = (path: string): SeoPage | null => {
    const page = directory.paths.get(path);
    const agencies = page?.count ?? 0;
    const type = pageTypeOf(path);
    const parts = path.split("/").filter(Boolean);
    const base = { key: path, type, path, agencies, indexed: agencies >= MIN_AGENCIES_TO_INDEX };
    if (type === "service-industry") {
      const s = service.get(parts[0]);
      const i = industry.get(parts[1].slice(4));
      if (!s || !i) return null;
      const c = copy.get(`${s.id}|${i.id}`);
      return {
        ...base,
        label: `${s.name} for ${i.name}`,
        copy: c && copyComplete(c) ? "complete" : "missing",
        leads30d: leadCount.get(`${s.id}|${i.id}`) ?? 0,
        lastUpdated: newest(page?.lastModified, c?.updated_at),
        editHref: `/admin/taxonomy/combo?service=${s.slug}&industry=${i.slug}`,
      };
    }
    const label =
      type === "service"
        ? `${service.get(parts[0])?.name ?? parts[0]} (all)`
        : type === "industry"
          ? `Agencies for ${industry.get(parts[1])?.name ?? parts[1]}`
          : type === "location"
            ? `Agencies in ${place.get(parts[parts.length - 1]) ?? parts[parts.length - 1]}`
            : type === "service-location"
              ? `${service.get(parts[0])?.name ?? parts[0]} in ${place.get(parts[1].slice(3)) ?? parts[1]}`
              : `${service.get(parts[0])?.name ?? parts[0]} for ${industry.get(parts[1].slice(4))?.name ?? parts[1]} in ${place.get(parts[2].slice(3)) ?? parts[2]}`;
    const c = pageCopy.get(path);
    const intro = type === "service" ? service.get(parts[0])?.intro : c?.intro;
    return {
      ...base,
      label,
      copy: intro?.trim() ? "complete" : "missing",
      leads30d: null,
      lastUpdated: newest(page?.lastModified, c?.updated_at),
      // Service hubs show the service intro (Admin → Taxonomy); the rest use page_content.
      editHref:
        type === "service"
          ? "/admin/taxonomy"
          : `/admin/seo-pages/edit?path=${encodeURIComponent(path)}`,
    };
  };

  const paths = new Set([
    ...directory.paths.keys(),
    ...services.flatMap((s) => industries.map((i) => `/${s.slug}/for-${i.slug}`)),
  ]);
  const pages = [...paths].map(row).filter((p): p is SeoPage => p !== null);

  return pages.sort(
    (a, b) =>
      b.agencies - a.agencies ||
      (b.leads30d ?? -1) - (a.leads30d ?? -1) ||
      a.label.localeCompare(b.label),
  );
}
