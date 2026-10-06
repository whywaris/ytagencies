import "server-only";

import { getDirectoryIndex } from "@/lib/data/agencies";
import { getIndustries, getLocations, getServices } from "@/lib/data/taxonomy";
import { MIN_AGENCIES_TO_INDEX } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// SEO pages health (ADMIN_V2_SPEC §5.6): every service × industry and service × location page.
// Agency counts come from the same index as the sitemap, so they can't disagree with it.
// Location pages have no copy of their own and leads don't record a location, so those two
// columns are reported as not applicable rather than guessed.

export type SeoPage = {
  key: string;
  kind: "industry" | "location";
  service: string;
  segment: string; // "Doctors & clinics", "USA"
  path: string;
  agencies: number;
  indexed: boolean;
  /** null for location pages: they use the shared template. */
  copy: "complete" | "missing" | null;
  /** null for location pages: leads don't record a location. */
  leads30d: number | null;
  lastUpdated: string | null;
  editHref: string | null;
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
  const [services, industries, locations, directory, content] = await Promise.all([
    getServices(),
    getIndustries(),
    getLocations(),
    getDirectoryIndex(),
    db
      .from("service_industry_content")
      .select("service_id, industry_id, intro, how_to_choose, faqs, updated_at"),
  ]);
  if (content.error) throw new Error("Couldn't load page copy");

  const copy = new Map(content.data.map((c) => [`${c.service_id}|${c.industry_id}`, c]));
  const leadCount = new Map<string, number>();
  for (const l of leads) {
    const k = `${l.service_id}|${l.industry_id}`;
    leadCount.set(k, (leadCount.get(k) ?? 0) + 1);
  }
  const newest = (a: string | null | undefined, b: string | null | undefined) =>
    !a ? (b ?? null) : !b ? a : a > b ? a : b;

  const pages: SeoPage[] = services.flatMap((s) => [
    ...industries.map((i): SeoPage => {
      const key = `${s.slug}|for-${i.slug}`;
      const page = directory.pages.get(key);
      const c = copy.get(`${s.id}|${i.id}`);
      const agencies = page?.count ?? 0;
      return {
        key,
        kind: "industry",
        service: s.name,
        segment: i.name,
        path: `/${s.slug}/for-${i.slug}`,
        agencies,
        indexed: agencies >= MIN_AGENCIES_TO_INDEX,
        copy: c && copyComplete(c) ? "complete" : "missing",
        leads30d: leadCount.get(`${s.id}|${i.id}`) ?? 0,
        lastUpdated: newest(page?.lastModified, c?.updated_at),
        editHref: `/admin/taxonomy/combo?service=${s.slug}&industry=${i.slug}`,
      };
    }),
    ...locations.map((l): SeoPage => {
      const key = `${s.slug}|in-${l.slug}`;
      const page = directory.pages.get(key);
      const agencies = page?.count ?? 0;
      return {
        key,
        kind: "location",
        service: s.name,
        segment: l.name,
        path: `/${s.slug}/in-${l.slug}`,
        agencies,
        indexed: agencies >= MIN_AGENCIES_TO_INDEX,
        copy: null,
        leads30d: null,
        lastUpdated: page?.lastModified ?? null,
        editHref: null,
      };
    }),
  ]);

  return pages.sort(
    (a, b) =>
      b.agencies - a.agencies ||
      (b.leads30d ?? -1) - (a.leads30d ?? -1) ||
      a.service.localeCompare(b.service) ||
      a.segment.localeCompare(b.segment),
  );
}
