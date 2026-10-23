import "server-only";
import { cache } from "react";

import { getPlacement } from "@/lib/data/placement";
import { getIndustries, getLocations, getServices, type Segment } from "@/lib/data/taxonomy";
import type { Entitlements } from "@/lib/entitlements";
import { thinProfileMissing } from "@/lib/profile-seo";
import { qualityScore, rankAgencies } from "@/lib/ranking";
import { MIN_AGENCIES_TO_INDEX } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
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
  /** lib/pricing.ts values; null until the agency fills them in. */
  minContract: string | null;
  adSpend: string | null;
  setupFeeUsd: number | null;
  /** Median time to contact a lead (3+ contacted in 90 days, under 2 days); managed only. */
  response: { medianMinutes: number; contacted: number } | null;
  languages: string[];
  isVerified: boolean;
  /** Live Pro subscription (lib/entitlements.ts): contactable. Not part of the ranking. */
  managed: boolean;
  /** 0–100, orders agencies within their group (lib/ranking.ts, /how-we-rank). */
  quality: number;
  /** Holds a sponsored slot on the page being rendered. */
  sponsored: boolean;
  hq: Tag | null;
  services: Tag[]; // primary first
  industries: Tag[]; // primary first
  rating: { average: number; count: number } | null;
  /** Last profile change: "Updated {Month YYYY}" on directory pages. */
  updatedAt: string;
};

export type AgencyProfile = AgencyListItem & {
  entitlements: Entitlements;
  description: string | null;
  website: string | null;
  foundedYear: number | null;
  isClaimed: boolean;
  updatedAt: string;
  /** Admin-set search title / description; null uses the generated ones. */
  seoTitle: string | null;
  seoDescription: string | null;
  locations: (Tag & { type: string })[];
  bestFor: string | null;
  timezone: string | null;
  linkedinUrl: string | null;
  youtubeChannelUrl: string | null;
  /** Pro booking buttons (lib/booking.ts); shown only while managed. */
  calendlyUrl: string | null;
  whatsappNumber: string | null;
  /** HQ as city + country names; a country-level HQ has city null. */
  hqCity: string | null;
  hqCountry: string | null;
  /** Thin-profile rule (lib/profile-seo.ts): empty means indexable. */
  seoMissing: string[];
  reportingFrequency: string | null;
  /** 0–5 steps, as the agency described its process. */
  process: { title: string; description: string }[];
  /** Per chosen service: focus %, what's included, optional own price. Primary first. */
  serviceDetails: (Tag & {
    focusPct: number | null;
    included: string[];
    startingPrice: number | null;
    priceUnit: string | null;
  })[];
  /** Per chosen industry: focus %. Primary first. */
  industryDetails: (Tag & { focusPct: number | null })[];
  /** Up to 6 channels the agency worked on (agency_channels). */
  channels: {
    id: string;
    url: string;
    title: string | null;
    subscribers: number | null;
    industry: string | null;
    confirmed: boolean;
  }[];
  caseStudies: {
    id: string;
    title: string;
    summary: string | null;
    channelUrl: string | null;
    metrics: Json | null;
    industry: Tag | null;
    service: Tag | null;
  }[];
  reviews: {
    id: string;
    authorName: string;
    authorCompany: string | null;
    rating: number;
    body: string;
    createdAt: string;
    service: string | null;
    budgetRange: string | null;
    projectStart: string | null;
    projectEnd: string | null;
    scores: { quality: number; schedule: number; cost: number; refer: number } | null;
    overall: number | null;
    reviewerTitle: string | null;
    reviewerIndustry: string | null;
    reviewerCompanySize: string | null;
    reviewerCountry: string | null;
    verifiedClient: boolean;
  }[];
  /** The latest approved verification's checklist (read server-side: anon can't). */
  verificationRecord: {
    checkedAt: string;
    domain: boolean;
    business: boolean;
    ownership: boolean;
    channelsChecked: number;
  } | null;
};

const LIST_SELECT = `
  id, slug, name, tagline, description, logo_path, min_budget_usd, team_size, pricing_model, languages, is_verified,
  min_contract, ad_spend, setup_fee_usd, updated_at,
  hq:locations!agencies_hq_location_id_fkey(slug, name),
  case_study_count:case_studies(count),
  location_count:agency_locations(count),
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

export function listQuery() {
  // Alphabetical here; directory pages rank in JS (rankAgencies) because plans and sponsored
  // slots aren't readable with the anon key.
  return createStaticClient()
    .from("agencies")
    .select(LIST_SELECT)
    .eq("status", "published")
    .order("name");
}

type ListRow = NonNullable<Awaited<ReturnType<typeof listQuery>>["data"]>[number];

type Placement = Awaited<ReturnType<typeof getPlacement>>;

/**
 * Response times from the agency_response_times view: an aggregate over private lead routes that
 * only lists agencies with enough recent data (3+ contacted leads in 90 days, median under 2 days).
 */
export const getResponseTimes = cache(async () => {
  const { data, error } = await createStaticClient()
    .from("agency_response_times")
    .select("agency_id, median_minutes, contacted");
  if (error) throw error;
  return new Map(
    data.map((r) => [r.agency_id, { medianMinutes: r.median_minutes, contacted: r.contacted }]),
  );
});
type ResponseTimes = Awaited<ReturnType<typeof getResponseTimes>>;

export function toListItem(
  row: ListRow,
  placement: Placement,
  responses: ResponseTimes,
): AgencyListItem {
  const e = placement.entitlements(row.id);
  const rating = ratingOf(row.reviews);
  // Unmanaged listings get no inquiries, so no reply time either.
  const response = e.responseTime ? (responses.get(row.id) ?? null) : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    logoPath: row.logo_path,
    minBudgetUsd: row.min_budget_usd,
    teamSize: row.team_size,
    pricingModel: row.pricing_model,
    minContract: row.min_contract,
    adSpend: row.ad_spend,
    setupFeeUsd: row.setup_fee_usd,
    updatedAt: row.updated_at,
    response,
    languages: row.languages ?? [],
    isVerified: row.is_verified,
    managed: e.managed,
    quality: qualityScore({
      hasLogo: !!row.logo_path,
      hasTagline: !!row.tagline?.trim(),
      descriptionLength: row.description?.trim().length ?? 0,
      hasMinBudget: row.min_budget_usd !== null,
      caseStudies: row.case_study_count[0]?.count ?? 0,
      locations: row.location_count[0]?.count ?? 0,
      reviews: rating,
      verification: placement.verification(row.id),
      responseMinutes: response?.medianMinutes ?? null,
    }),
    sponsored: false,
    hq: row.hq,
    services: primaryFirst(row.agency_services, (r) => r.services),
    industries: primaryFirst(row.agency_industries, (r) => r.industries),
    rating,
  };
}

/** Lists for a page, in ranking order: sponsored, paid, free (§6). */
async function rankedList(
  ids: string[],
  page: { serviceId: number; industryId?: number; locationId?: number },
) {
  if (ids.length === 0) return [];
  const [{ data, error }, placement, responses] = await Promise.all([
    listQuery().in("id", ids),
    getPlacement(),
    getResponseTimes(),
  ]);
  if (error) throw error;
  return rankAgencies(
    data.map((row) => toListItem(row, placement, responses)),
    placement.sponsoredFor(page),
  );
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
export const getAgenciesForService = cache(async (serviceId: number) =>
  rankedList(await idsFor(serviceId), { serviceId }),
);

/** Agencies offering a service for an industry or in a location (combination page). */
export const getAgenciesForCombo = cache(async (serviceId: number, segment: Segment) =>
  rankedList(
    await idsFor(serviceId, segment),
    segment.kind === "industry"
      ? { serviceId, industryId: segment.industry.id }
      : { serviceId, locationId: segment.location.id },
  ),
);

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
      website, founded_year, is_claimed, updated_at, seo_title, seo_description,
      best_for, timezone, reporting_frequency, process, linkedin_url, youtube_channel_url,
      calendly_url, whatsapp_number,
      service_details:agency_services(is_primary, focus_pct, included, starting_price, price_unit, services(slug, name)),
      industry_details:agency_industries(is_primary, focus_pct, industries(slug, name)),
      agency_channels(id, channel_url, title, subscriber_count, status, created_at, industries(name)),
      agency_locations(locations(slug, name, type)),
      case_studies(id, title, summary, channel_url, metrics, created_at, industries(slug, name), services(slug, name)),
      published_reviews:reviews(id, author_name, author_company, rating, body, created_at, budget_range,
        project_start, project_end, score_quality, score_schedule, score_cost, score_refer, overall,
        reviewer_title, reviewer_company_size, reviewer_country, verified_client,
        services(name), reviewer_industry:industries(name))`,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .eq("published_reviews.status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [placement, responses, verificationRecord, locations] = await Promise.all([
    getPlacement(),
    getResponseTimes(),
    getVerificationRecord(data.id),
    getLocations(),
  ]);
  const hq = data.hq && locations.find((l) => l.slug === data.hq!.slug);
  const hqParent = hq?.parentId ? locations.find((l) => l.id === hq.parentId) : null;
  const steps = Array.isArray(data.process) ? data.process : [];

  return {
    ...toListItem(data, placement, responses),
    entitlements: placement.entitlements(data.id),
    description: data.description,
    website: data.website,
    foundedYear: data.founded_year,
    isClaimed: data.is_claimed,
    updatedAt: data.updated_at,
    seoTitle: data.seo_title,
    seoDescription: data.seo_description,
    bestFor: data.best_for,
    timezone: data.timezone,
    linkedinUrl: data.linkedin_url,
    youtubeChannelUrl: data.youtube_channel_url,
    calendlyUrl: data.calendly_url,
    whatsappNumber: data.whatsapp_number,
    hqCity: hqParent ? (hq?.name ?? null) : null,
    hqCountry: hqParent ? hqParent.name : (hq?.name ?? null),
    seoMissing: thinProfileMissing({
      hasDescription: !!data.description?.trim(),
      hasBestFor: !!data.best_for?.trim(),
      industries: data.agency_industries.length,
      hasPrice: data.min_budget_usd !== null,
    }),
    reportingFrequency: data.reporting_frequency,
    process: steps.flatMap((s) =>
      s && typeof s === "object" && !Array.isArray(s) && typeof s.title === "string"
        ? [{ title: s.title, description: typeof s.description === "string" ? s.description : "" }]
        : [],
    ),
    serviceDetails: [...data.service_details]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .map((r) => ({
        ...r.services,
        focusPct: r.focus_pct,
        included: r.included,
        startingPrice: r.starting_price,
        priceUnit: r.price_unit,
      })),
    industryDetails: [...data.industry_details]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .map((r) => ({ ...r.industries, focusPct: r.focus_pct })),
    channels: [...data.agency_channels]
      // Confirmed first, then the order they were added.
      .sort(
        (a, b) =>
          Number(b.status === "confirmed") - Number(a.status === "confirmed") ||
          a.created_at.localeCompare(b.created_at),
      )
      .slice(0, 6)
      .map((c) => ({
        id: c.id,
        url: c.channel_url,
        title: c.title,
        subscribers: c.subscriber_count,
        industry: c.industries?.name ?? null,
        confirmed: c.status === "confirmed",
      })),
    verificationRecord,
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
        service: c.services,
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
        service: r.services?.name ?? null,
        budgetRange: r.budget_range,
        projectStart: r.project_start,
        projectEnd: r.project_end,
        scores:
          r.score_quality !== null &&
          r.score_schedule !== null &&
          r.score_cost !== null &&
          r.score_refer !== null
            ? {
                quality: Number(r.score_quality),
                schedule: Number(r.score_schedule),
                cost: Number(r.score_cost),
                refer: Number(r.score_refer),
              }
            : null,
        overall: r.overall === null ? null : Number(r.overall),
        reviewerTitle: r.reviewer_title,
        reviewerIndustry: r.reviewer_industry?.name ?? null,
        reviewerCompanySize: r.reviewer_company_size,
        reviewerCountry: r.reviewer_country,
        verifiedClient: r.verified_client,
      })),
  };
});

/**
 * The latest approved verification's checklist, for the profile's "What was verified" (service
 * role: anon can't read verifications). Only the ticks, the date and how many channels were
 * checked are used; nothing private.
 */
async function getVerificationRecord(agencyId: string) {
  const { data } = await createAdminClient()
    .from("verifications")
    .select("checklist, channels, reviewed_at, created_at")
    .eq("agency_id", agencyId)
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const checks = (data.checklist ?? {}) as Record<string, unknown>;
  return {
    checkedAt: data.reviewed_at ?? data.created_at,
    domain: checks.domain === true,
    business: checks.business === true,
    ownership: checks.ownership === true,
    channelsChecked: Array.isArray(data.channels) ? data.channels.length : 0,
  };
}

/**
 * Every published agency slug + last update, for generateStaticParams and the sitemap, with
 * whether the profile is indexable (thin profiles are noindex and left out of the sitemap).
 */
export const getAgencySlugs = cache(async () => {
  const { data, error } = await createStaticClient()
    .from("agencies")
    .select("slug, updated_at, description, best_for, min_budget_usd, agency_industries(count)")
    .eq("status", "published");
  if (error) throw error;
  return data.map((a) => {
    // The same rule the profile uses for its noindex (getAgencyBySlug → seoMissing).
    const missing = thinProfileMissing({
      hasDescription: !!a.description?.trim(),
      hasBestFor: !!a.best_for?.trim(),
      industries: a.agency_industries[0]?.count ?? 0,
      hasPrice: a.min_budget_usd !== null,
    });
    return { slug: a.slug, updatedAt: a.updated_at, missing, indexable: missing.length === 0 };
  });
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
  const hubCounts = new Map<string, number>(); // service slug -> published agencies
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
      hubCounts.set(services.slug, (hubCounts.get(services.slug) ?? 0) + 1);
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
  return { combos, hubs, hubCounts, siteLastModified, pages };
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
  // Only managed agencies: the point is to reach someone who replies.
  const candidates = new Map(
    lists
      .flat()
      .filter((a) => a.managed)
      .map((a) => [a.id, a]),
  );
  candidates.delete(agency.id);
  if (candidates.size < limit) {
    // Too few share a service: widen to every published managed agency, ranked the same way.
    for (const a of await getPublishedAgencies())
      if (a.id !== agency.id && a.managed) candidates.set(a.id, a);
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
  const [{ data, error }, placement, responses] = await Promise.all([
    listQuery(),
    getPlacement(),
    getResponseTimes(),
  ]);
  if (error) throw error;
  return data.map((row) => toListItem(row, placement, responses));
});
