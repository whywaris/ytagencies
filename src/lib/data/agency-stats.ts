import "server-only";
import { cache } from "react";

import { getAgenciesForCombo, getAgenciesForService, getAgencyCount } from "@/lib/data/agencies";
import { getPlacement } from "@/lib/data/placement";
import { getServiceBySlug, resolveSegment } from "@/lib/data/taxonomy";
import type { StrengthInput } from "@/lib/profile-strength";
import { MAX_SPONSORED } from "@/lib/ranking";
import { createAdminClient } from "@/lib/supabase/admin";

// Real numbers for the agency-facing pages (/list-your-agency, /claim, the dashboard). Analytics
// tables are admin-read only, so this reads with the service role; callers decide who may see
// what (owners their own agency, everyone only the public aggregates). Never invent a number:
// every function returns 0 / empty when there's no data, and the pages hide those.

const DAY = 86_400_000;
/** yyyy-mm-dd, n days before today (UTC). */
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

/** Profile views per agency over the last `days` days (visitor-days, bots excluded). */
export async function profileViews(agencyIds: string[], days = 30) {
  const views = new Map<string, number>();
  if (agencyIds.length === 0) return views;
  const { data, error } = await createAdminClient()
    .from("agency_event_daily")
    .select("agency_id, count")
    .in("agency_id", agencyIds)
    .eq("type", "profile_view")
    .gte("day", daysAgo(days));
  if (error) throw error;
  for (const r of data) views.set(r.agency_id, (views.get(r.agency_id) ?? 0) + r.count);
  return views;
}

/** One agency's last 30 days against the 30 before (for the dashboard's stat row). */
export async function agencyActivity(agencyId: string) {
  const { data, error } = await createAdminClient()
    .from("agency_event_daily")
    .select("day, type, count")
    .eq("agency_id", agencyId)
    .gte("day", daysAgo(60));
  if (error) throw error;
  const cut = daysAgo(30);
  const sum = (type: string, recent: boolean) =>
    data.filter((r) => r.type === type && r.day >= cut === recent).reduce((n, r) => n + r.count, 0);
  return {
    views: sum("profile_view", true),
    viewsBefore: sum("profile_view", false),
    clicks: sum("website_click", true),
    clicksBefore: sum("website_click", false),
    inquiries: sum("inquiry", true),
  };
}

/** /list-your-agency's live strip: last 30 days, site-wide. */
export const getSiteNumbers = cache(async () => {
  const db = createAdminClient();
  const since = daysAgo(30);
  const [pages, profiles, routes, agencies] = await Promise.all([
    db.from("page_view_daily").select("count").gte("day", since),
    db.from("agency_event_daily").select("count").eq("type", "profile_view").gte("day", since),
    db
      .from("lead_routes")
      .select("lead_id", { count: "exact", head: true })
      .gte("sent_at", new Date(Date.now() - 30 * DAY).toISOString()),
    getAgencyCount(),
  ]);
  if (pages.error || profiles.error || routes.error) throw new Error("Couldn't load numbers");
  const total = (rows: { count: number }[]) => rows.reduce((n, r) => n + r.count, 0);
  return {
    views: total(pages.data) + total(profiles.data),
    inquiries: routes.count ?? 0,
    agencies,
  };
});

/** Get matched requests this calendar month (UTC) for a service in an industry. */
export async function requestsThisMonth(serviceId: number, industryId: number) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count, error } = await createAdminClient()
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("service_id", serviceId)
    .eq("industry_id", industryId)
    .gte("created_at", start);
  if (error) throw error;
  return count ?? 0;
}

export type DemandRow = {
  path: string;
  label: string;
  visitors: number;
  agencies: number;
  /** 1-based place on the page (lib/ranking.ts order), or null when not listed there. */
  spot: number | null;
  /** The industry this page is for, when the agency doesn't list it. */
  missingIndustry: string | null;
  /** The page has a free sponsored position (fewer than MAX_SPONSORED active slots). */
  openSlot: boolean;
};

/**
 * "Where businesses are looking": the most-visited directory pages for the agency's services in
 * the last 30 days, and where the agency appears on each.
 */
export async function demandFor(
  agency: { id: string; services: { slug: string }[]; industries: { slug: string }[] },
  limit = 5,
): Promise<DemandRow[]> {
  if (agency.services.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("page_view_daily")
    .select("path, count")
    .gte("day", daysAgo(30))
    .or(agency.services.map((s) => `path.like./${s.slug}*`).join(","));
  if (error) throw error;
  const visits = new Map<string, number>();
  for (const r of data) visits.set(r.path, (visits.get(r.path) ?? 0) + r.count);
  const top = [...visits.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

  const placement = await getPlacement();
  const ownIndustries = new Set(agency.industries.map((i) => i.slug));
  const rows = await Promise.all(
    top.map(async ([path, visitors]): Promise<DemandRow | null> => {
      const [, serviceSlug, segmentSlug] = path.split("/");
      const service = await getServiceBySlug(serviceSlug);
      if (!service) return null;
      const segment = segmentSlug ? await resolveSegment(segmentSlug) : null;
      if (segmentSlug && !segment) return null;
      const list = segment
        ? await getAgenciesForCombo(service.id, segment)
        : await getAgenciesForService(service.id);
      const index = list.findIndex((a) => a.id === agency.id);
      const page = {
        serviceId: service.id,
        industryId: segment?.kind === "industry" ? segment.industry.id : undefined,
        locationId: segment?.kind === "location" ? segment.location.id : undefined,
      };
      return {
        path,
        label: !segment
          ? `${service.name} agencies`
          : segment.kind === "industry"
            ? `${service.name} for ${segment.industry.name.toLowerCase()}`
            : `${service.name} in ${segment.location.name}`,
        visitors,
        agencies: list.length,
        spot: index === -1 ? null : index + 1,
        missingIndustry:
          segment?.kind === "industry" && !ownIndustries.has(segment.slug)
            ? segment.industry.name
            : null,
        openSlot: placement.sponsoredFor(page).length < MAX_SPONSORED,
      };
    }),
  );
  return rows.filter((r): r is DemandRow => r !== null);
}

/** What profileStrength() needs, for any agency (drafts too). Callers check ownership first. */
export async function strengthInput(agencyId: string): Promise<StrengthInput> {
  const { data, error } = await createAdminClient()
    .from("agencies")
    .select(
      "logo_path, description, best_for, min_budget_usd, min_contract, hq_location_id, agency_services(focus_pct), agency_locations(count), agency_channels(count), case_studies(count)",
    )
    .eq("id", agencyId)
    .single();
  if (error) throw error;
  return {
    hasLogo: !!data.logo_path,
    descriptionLength: data.description?.trim().length ?? 0,
    hasBestFor: !!data.best_for?.trim(),
    hasStartingPrice: data.min_budget_usd !== null,
    hasContract: !!data.min_contract,
    hasServiceFocus:
      data.agency_services.length > 0 && data.agency_services.every((s) => s.focus_pct !== null),
    hasLocation: !!data.hq_location_id || (data.agency_locations[0]?.count ?? 0) > 0,
    channels: data.agency_channels[0]?.count ?? 0,
    caseStudies: data.case_studies[0]?.count ?? 0,
  };
}
