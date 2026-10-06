import "server-only";
import { cache } from "react";

import { getIndustries, getLocations, getServices, type Segment } from "@/lib/data/taxonomy";
import { MIN_AGENCIES_TO_INDEX } from "@/lib/site";
import { createStaticClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

// Public agency reads. Anon client + RLS means only published agencies and published reviews come back;
// the explicit status filters are a second guard.

type Tag = { slug: string; name: string };

export type AgencyListItem = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoPath: string | null;
  minBudgetUsd: number | null;
  teamSize: string | null;
  pricingModel: string | null;
  languages: string[];
  isVerified: boolean;
  isFeatured: boolean;
  hq: Tag | null;
  services: Tag[]; // primary first
  industries: Tag[]; // primary first
  rating: { average: number; count: number } | null;
};

export type AgencyProfile = AgencyListItem & {
  description: string | null;
  website: string | null;
  foundedYear: number | null;
  isClaimed: boolean;
  updatedAt: string;
  locations: (Tag & { type: string })[];
  caseStudies: {
    id: string;
    title: string;
    summary: string | null;
    channelUrl: string | null;
    metrics: Json | null;
    industry: Tag | null;
  }[];
  reviews: {
    id: string;
    authorName: string;
    authorCompany: string | null;
    rating: number;
    body: string;
    createdAt: string;
  }[];
};

const LIST_SELECT = `
  id, slug, name, tagline, logo_path, min_budget_usd, team_size, pricing_model, languages, is_verified, is_featured,
  hq:locations!agencies_hq_location_id_fkey(slug, name),
  agency_services(is_primary, services(slug, name)),
  agency_industries(is_primary, industries(slug, name)),
  reviews(rating)
`;

type JoinRow = { is_primary: boolean | null };

function primaryFirst<T extends JoinRow>(rows: T[], pick: (r: T) => Tag | null): Tag[] {
  return [...rows]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map(pick)
    .filter((t): t is Tag => t !== null);
}

function ratingOf(reviews: { rating: number }[]) {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((n, r) => n + r.rating, 0);
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}

function listQuery() {
  // Featured (paid) first, then verified, then alphabetical.
  return createStaticClient()
    .from("agencies")
    .select(LIST_SELECT)
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("is_verified", { ascending: false })
    .order("name");
}

type ListRow = NonNullable<Awaited<ReturnType<typeof listQuery>>["data"]>[number];

function toListItem(row: ListRow): AgencyListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    logoPath: row.logo_path,
    minBudgetUsd: row.min_budget_usd,
    teamSize: row.team_size,
    pricingModel: row.pricing_model,
    languages: row.languages ?? [],
    isVerified: row.is_verified,
    isFeatured: row.is_featured,
    hq: row.hq,
    services: primaryFirst(row.agency_services, (r) => r.services),
    industries: primaryFirst(row.agency_industries, (r) => r.industries),
    rating: ratingOf(row.reviews),
  };
}

// ponytail: id lookups are plain selects intersected in JS, capped by PostgREST's max rows (1000 by default).
// Move to an RPC or view when a single service has ~1000 agencies.
async function idsFor(serviceId: number, segment?: Segment): Promise<string[]> {
  const supabase = createStaticClient();
  const services = supabase.from("agency_services").select("agency_id").eq("service_id", serviceId);
  const second = !segment
    ? null
    : segment.kind === "industry"
      ? supabase
          .from("agency_industries")
          .select("agency_id")
          .eq("industry_id", segment.industry.id)
      : supabase
          .from("agency_locations")
          .select("agency_id")
          .in("location_id", segment.locationIds);

  const [a, b] = await Promise.all([services, second]);
  if (a.error) throw a.error;
  const ids = new Set(a.data.map((r) => r.agency_id));
  if (!b) return [...ids];
  if (b.error) throw b.error;
  return [...new Set(b.data.map((r) => r.agency_id).filter((id) => ids.has(id)))];
}

/** Agencies offering a service (service hub page). */
export const getAgenciesForService = cache(async (serviceId: number) => {
  const ids = await idsFor(serviceId);
  if (ids.length === 0) return [];
  const { data, error } = await listQuery().in("id", ids);
  if (error) throw error;
  return data.map(toListItem);
});

/** Agencies offering a service for an industry or in a location (combination page). */
export const getAgenciesForCombo = cache(async (serviceId: number, segment: Segment) => {
  const ids = await idsFor(serviceId, segment);
  if (ids.length === 0) return [];
  const { data, error } = await listQuery().in("id", ids);
  if (error) throw error;
  return data.map(toListItem);
});

/** Published agency count for a combination. Drives the thin-page rule. */
export const getComboCount = cache(async (serviceId: number, segment: Segment) => {
  const ids = await idsFor(serviceId, segment);
  if (ids.length === 0) return 0;
  const { count, error } = await createStaticClient()
    .from("agencies")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .in("id", ids);
  if (error) throw error;
  return count ?? 0;
});

export async function isComboIndexable(serviceId: number, segment: Segment) {
  return (await getComboCount(serviceId, segment)) >= MIN_AGENCIES_TO_INDEX;
}

/** Full profile for /agency/[slug]. Null means notFound(). */
export const getAgencyBySlug = cache(async (slug: string): Promise<AgencyProfile | null> => {
  const { data, error } = await createStaticClient()
    .from("agencies")
    .select(
      `${LIST_SELECT},
      description, website, founded_year, is_claimed, updated_at,
      agency_locations(locations(slug, name, type)),
      case_studies(id, title, summary, channel_url, metrics, created_at, industries(slug, name)),
      published_reviews:reviews(id, author_name, author_company, rating, body, created_at)`,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .eq("published_reviews.status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    ...toListItem(data),
    description: data.description,
    website: data.website,
    foundedYear: data.founded_year,
    isClaimed: data.is_claimed,
    updatedAt: data.updated_at,
    locations: data.agency_locations
      .map((r) => r.locations)
      .filter((l): l is Tag & { type: string } => l !== null),
    caseStudies: [...data.case_studies]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((c) => ({
        id: c.id,
        title: c.title,
        summary: c.summary,
        channelUrl: c.channel_url,
        metrics: c.metrics,
        industry: c.industries,
      })),
    reviews: [...data.published_reviews]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => ({
        id: r.id,
        authorName: r.author_name,
        authorCompany: r.author_company,
        rating: r.rating,
        body: r.body,
        createdAt: r.created_at,
      })),
  };
});

/** Every published agency slug + last update, for generateStaticParams and the sitemap. */
export const getAgencySlugs = cache(async () => {
  const { data, error } = await createStaticClient()
    .from("agencies")
    .select("slug, updated_at")
    .eq("status", "published");
  if (error) throw error;
  return data.map((a) => ({ slug: a.slug, updatedAt: a.updated_at }));
});

/**
 * One pass over published agencies: which service × industry / service × location pages are
 * indexable (thin-page rule), and when each page and service hub last changed (newest agency
 * updated_at). Feeds the sitemaps and the internal links, so the two always agree.
 * Location pages count a country's cities too, matching resolveSegment().
 */
// ponytail: aggregated in JS from one query, capped at PostgREST max rows (1000 published
// agencies by default). Move to a SQL view when the directory grows past that.
export const getDirectoryIndex = cache(async () => {
  const supabase = createStaticClient();
  const [{ data, error }, locations, services, industries, comboCopy] = await Promise.all([
    supabase
      .from("agencies")
      .select(
        "updated_at, agency_services(services(slug)), agency_industries(industries(slug)), agency_locations(location_id)",
      )
      .eq("status", "published"),
    getLocations(),
    // Copy on these pages has its own updated_at (trigger-maintained, schema.sql).
    supabase.from("services").select("slug, updated_at"),
    supabase.from("industries").select("slug, updated_at"),
    supabase
      .from("service_industry_content")
      .select("updated_at, services(slug), industries(slug)"),
  ]);
  if (error) throw error;
  for (const r of [services, industries, comboCopy]) if (r.error) throw r.error;

  const byId = new Map(locations.map((l) => [l.id, l]));
  const pages = new Map<string, { count: number; lastModified: string }>(); // "service|segment"
  const hubs = new Map<string, string>(); // service slug -> lastModified
  const newer = (a: string | undefined, b: string) => (a && a > b ? a : b);
  let siteLastModified: string | null = null;

  for (const agency of data) {
    siteLastModified = newer(siteLastModified ?? undefined, agency.updated_at);
    const segments = new Set<string>();
    for (const { industries } of agency.agency_industries) segments.add(`for-${industries.slug}`);
    for (const { location_id } of agency.agency_locations) {
      const loc = byId.get(location_id);
      if (!loc) continue;
      segments.add(`in-${loc.slug}`);
      const parent = loc.parentId ? byId.get(loc.parentId) : undefined;
      if (parent) segments.add(`in-${parent.slug}`);
    }
    for (const { services } of agency.agency_services) {
      hubs.set(services.slug, newer(hubs.get(services.slug), agency.updated_at));
      for (const segment of segments) {
        const key = `${services.slug}|${segment}`;
        const page = pages.get(key);
        pages.set(key, {
          count: (page?.count ?? 0) + 1,
          lastModified: newer(page?.lastModified, agency.updated_at),
        });
      }
    }
  }

  // Hubs show the service intro; industry pages show the industry intro or their own copy.
  for (const svc of services.data!) {
    hubs.set(svc.slug, newer(hubs.get(svc.slug), svc.updated_at));
    siteLastModified = newer(siteLastModified ?? undefined, svc.updated_at);
  }
  const industryDate = new Map(industries.data!.map((i) => [i.slug, i.updated_at]));
  const copyDate = new Map(
    comboCopy.data!.map((c) => [`${c.services.slug}|for-${c.industries.slug}`, c.updated_at]),
  );
  for (const date of industryDate.values())
    siteLastModified = newer(siteLastModified ?? undefined, date);

  const combos = [...pages]
    .filter(([, p]) => p.count >= MIN_AGENCIES_TO_INDEX)
    .map(([key, p]) => {
      const [serviceSlug, segment] = key.split("|");
      let lastModified = p.lastModified;
      if (segment.startsWith("for-")) {
        const industry = industryDate.get(segment.slice(4));
        if (industry) lastModified = newer(lastModified, industry);
        const copy = copyDate.get(key);
        if (copy) lastModified = newer(lastModified, copy);
      }
      return { serviceSlug, segment, count: p.count, lastModified };
    });
  // Every page with at least one agency (indexable or not), for the admin SEO pages report.
  return { combos, hubs, siteLastModified, pages };
});

/** Indexable combination pages (sitemap + internal links). */
export async function getIndexableCombos() {
  return (await getDirectoryIndex()).combos;
}

/** Published agency count, for page descriptions. */
export const getAgencyCount = cache(async () => {
  const { count, error } = await createStaticClient()
    .from("agencies")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  if (error) throw error;
  return count ?? 0;
});

/**
 * Industries ranked by their best service × industry combo. Each links to that combo,
 * since industries have no page of their own (docs/SEO.md URL map).
 */
export const getPopularIndustries = cache(async (limit: number) => {
  const [{ data, error }, industries, services] = await Promise.all([
    createStaticClient().from("combo_counts").select("service_slug, industry_slug, agency_count"),
    getIndustries(),
    getServices(),
  ]);
  if (error) throw error;

  const best = new Map<string, { serviceSlug: string; count: number }>();
  for (const row of data) {
    const count = row.agency_count ?? 0;
    if (!row.industry_slug || !row.service_slug) continue;
    if (count > (best.get(row.industry_slug)?.count ?? 0)) {
      best.set(row.industry_slug, { serviceSlug: row.service_slug, count });
    }
  }

  return industries
    .flatMap((industry) => {
      const b = best.get(industry.slug);
      const service = b && services.find((s) => s.slug === b.serviceSlug);
      return b && service ? [{ industry, service, count: b.count }] : [];
    })
    .sort((a, b) => b.count - a.count) // stable: ties keep industry sort_order
    .slice(0, limit);
});

/**
 * Other agencies ranked by overlap: shared industries weigh more than shared services.
 * Ties break alphabetically so paid placement doesn't decide "similar".
 */
export async function getSimilarAgencies(agency: AgencyListItem, limit: number) {
  const services = await getServices();
  const serviceIds = services
    .filter((s) => agency.services.some((t) => t.slug === s.slug))
    .map((s) => s.id);
  const lists = await Promise.all(serviceIds.map((id) => getAgenciesForService(id)));

  const industries = new Set(agency.industries.map((i) => i.slug));
  const ownServices = new Set(agency.services.map((s) => s.slug));
  const candidates = new Map(lists.flat().map((a) => [a.id, a]));
  candidates.delete(agency.id);
  if (candidates.size < limit) {
    // Too few share a service: widen to every published agency, ranked the same way.
    for (const a of await getPublishedAgencies()) if (a.id !== agency.id) candidates.set(a.id, a);
  }

  const score = (a: AgencyListItem) =>
    a.industries.filter((i) => industries.has(i.slug)).length * 2 +
    a.services.filter((s) => ownServices.has(s.slug)).length;
  return [...candidates.values()]
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// ponytail: loads every published agency (PostgREST max rows cap, 1000 by default); only used to top up
// "Similar agencies" when too few share a service. Replace with an industry-based query at scale.
const getPublishedAgencies = cache(async () => {
  const { data, error } = await listQuery();
  if (error) throw error;
  return data.map(toListItem);
});
