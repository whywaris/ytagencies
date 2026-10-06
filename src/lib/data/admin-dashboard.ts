import "server-only";

import { getDirectoryIndex } from "@/lib/data/agencies";
import { getIndustries, getLocations, getServices } from "@/lib/data/taxonomy";
import { countInBuckets, delta, periodBuckets, type PeriodId } from "@/lib/periods";
import { MIN_AGENCIES_TO_INDEX } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUDGET_RANGES } from "@/lib/validation/lead";

// Everything on /admin (ADMIN_V2_SPEC §5.1). Service role, read-only; callers check the admin role.
// Every number comes from the database: no estimates, no placeholders.

export type AttentionItem = { id: string; label: string; href: string; since: string };
export type AttentionGroup = {
  type: string;
  heading: string;
  href: string;
  items: AttentionItem[];
  total: number;
};

const PER_GROUP = 5;

function check<T extends { error: unknown }>(r: T, what: string) {
  if (r.error) throw new Error(`Couldn't load ${what}`);
  return r;
}

const PAGE = 1000; // PostgREST's default max rows per request

/** Every row of a query, page by page, so nothing is silently cut off at 1,000 rows. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: rows, error: null };
  }
}

export async function getDashboard(period: PeriodId, now = new Date()) {
  const db = createAdminClient();
  const { current, previous } = periodBuckets(period, now);
  const from = previous[0].start.toISOString();
  const periodStart = current[0].start;
  const day = (d: Date) => d.toISOString().slice(0, 10);

  const [
    leads,
    recent,
    submissions,
    claims,
    reviews,
    verifications,
    published,
    claimed,
    comboCounts,
    events,
    services,
    industries,
    locations,
    directory,
  ] = await Promise.all([
    // ponytail: lead timestamps for both periods (up to 24 months) bucketed in JS. Move to a SQL
    // group-by when lead volume makes this slow.
    fetchAll((a, b) =>
      db
        .from("leads")
        .select("created_at, service_id, industry_id")
        .gte("created_at", from)
        .order("created_at", { ascending: true })
        .range(a, b),
    ),
    db
      .from("leads")
      .select(
        "id, name, budget_range, created_at, services(name), industries(name), lead_routes(agencies(name))",
      )
      .order("created_at", { ascending: false })
      .limit(8),
    db
      .from("agencies")
      .select("id, name, created_at", { count: "exact" })
      .eq("status", "draft")
      .not("submitted_by", "is", null)
      .order("created_at", { ascending: true })
      .limit(PER_GROUP),
    db
      .from("claims")
      .select("id, created_at, agencies!inner(name, status)", { count: "exact" })
      .eq("status", "pending")
      .neq("agencies.status", "draft")
      .order("created_at", { ascending: true })
      .limit(PER_GROUP),
    db
      .from("reviews")
      .select("id, author_name, created_at, agencies(name)", { count: "exact" })
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(PER_GROUP),
    db
      .from("verifications")
      .select("id, agency_id, created_at, agencies(name)", { count: "exact" })
      .eq("status", "requested")
      .order("created_at", { ascending: true })
      .limit(PER_GROUP),
    db.from("agencies").select("id", { count: "exact", head: true }).eq("status", "published"),
    db
      .from("agencies")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .eq("is_claimed", true),
    db.from("combo_counts").select("service_slug, industry_slug, agency_count"),
    fetchAll((a, b) =>
      db
        .from("agency_event_daily")
        .select("agency_id, day, type, count, agencies(name, slug)")
        .gte("day", day(periodStart))
        .in("type", ["profile_view", "inquiry"])
        .order("day")
        .order("agency_id")
        .order("type")
        .range(a, b),
    ),
    getServices(),
    getIndustries(),
    getLocations(),
    getDirectoryIndex(),
  ]);
  for (const [r, what] of [
    [leads, "leads"],
    [recent, "recent leads"],
    [submissions, "submissions"],
    [claims, "claims"],
    [reviews, "reviews"],
    [verifications, "verifications"],
    [published, "agencies"],
    [claimed, "agencies"],
    [comboCounts, "combinations"],
    [events, "agency events"],
  ] as const)
    check(r, what);

  // ───────── Leads: KPI + chart ─────────
  const stamps = leads.data!.map((l) => l.created_at);
  const cur = countInBuckets(stamps, current);
  const prev = countInBuckets(stamps, previous);
  const sum = (a: number[]) => a.reduce((n, x) => n + x, 0);
  const leadsNow = sum(cur);
  const leadsBefore = sum(prev);
  const series = current.map((b, i) => ({
    start: b.start.toISOString(),
    current: cur[i],
    previous: prev[i],
  }));

  // ───────── Needs your attention ─────────
  const groups: AttentionGroup[] = [
    {
      type: "submission",
      heading: "New agencies",
      href: "/admin/submissions",
      total: submissions.count ?? 0,
      items: submissions.data!.map((a) => ({
        id: a.id,
        label: a.name,
        href: "/admin/submissions",
        since: a.created_at,
      })),
    },
    {
      type: "claim",
      heading: "Claims",
      href: "/admin/claims",
      total: claims.count ?? 0,
      items: claims.data!.map((c) => ({
        id: c.id,
        label: c.agencies.name,
        href: "/admin/claims",
        since: c.created_at,
      })),
    },
    {
      type: "review",
      heading: "Reviews",
      href: "/admin/reviews",
      total: reviews.count ?? 0,
      items: reviews.data!.map((r) => ({
        id: r.id,
        label: r.agencies ? `${r.author_name} on ${r.agencies.name}` : r.author_name,
        href: "/admin/reviews",
        since: r.created_at,
      })),
    },
    {
      type: "verification",
      heading: "Verification requests",
      href: "/admin/verification",
      total: verifications.count ?? 0,
      items: verifications.data!.map((v) => ({
        id: v.id,
        label: v.agencies?.name ?? "Deleted agency",
        href: `/admin/verification/${v.agency_id}`,
        since: v.created_at,
      })),
    },
  ].filter((g) => g.total > 0);
  const needsAction = groups.reduce((n, g) => n + g.total, 0);
  const oldest =
    groups.flatMap((g) => g.items).sort((a, b) => a.since.localeCompare(b.since))[0] ?? null;

  // ───────── Supply gaps: service × industry, leads in period ÷ published agencies ─────────
  const svcById = new Map(services.map((s) => [s.id, s]));
  const indById = new Map(industries.map((i) => [i.id, i]));
  const agencyCount = new Map(
    comboCounts.data!.map((c) => [`${c.service_slug}|${c.industry_slug}`, Number(c.agency_count)]),
  );
  const leadsByCombo = new Map<string, number>();
  for (const l of leads.data!) {
    if (!l.service_id || !l.industry_id || new Date(l.created_at) < periodStart) continue;
    const s = svcById.get(l.service_id);
    const i = indById.get(l.industry_id);
    if (!s || !i) continue;
    const key = `${s.slug}|${i.slug}`;
    leadsByCombo.set(key, (leadsByCombo.get(key) ?? 0) + 1);
  }
  const gaps = [...leadsByCombo]
    .map(([key, count]) => {
      const [serviceSlug, industrySlug] = key.split("|");
      const agencies = agencyCount.get(key) ?? 0;
      return {
        key,
        service: services.find((s) => s.slug === serviceSlug)!.name,
        industry: industries.find((i) => i.slug === industrySlug)!.name,
        path: `/${serviceSlug}/for-${industrySlug}`,
        leads: count,
        agencies,
        indexed: agencies >= MIN_AGENCIES_TO_INDEX,
        // No agencies at all is the biggest gap.
        ratio: agencies === 0 ? Infinity : count / agencies,
      };
    })
    .sort((a, b) => b.ratio - a.ratio || b.leads - a.leads)
    .slice(0, 10);

  // ───────── Top agencies by profile views, then inquiries ─────────
  const byAgency = new Map<
    string,
    { name: string; slug: string; views: number; inquiries: number }
  >();
  for (const e of events.data!) {
    if (!e.agencies) continue;
    const row = byAgency.get(e.agency_id) ?? {
      name: e.agencies.name,
      slug: e.agencies.slug,
      views: 0,
      inquiries: 0,
    };
    if (e.type === "profile_view") row.views += e.count;
    else row.inquiries += e.count;
    byAgency.set(e.agency_id, row);
  }
  const topAgencies = [...byAgency]
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => b.views - a.views || b.inquiries - a.inquiries)
    .slice(0, 8);

  // ───────── SEO pages: indexable / every service × (industry or location) page ─────────
  const totalCombos = services.length * (industries.length + locations.length);

  const budget = new Map<string, string>(BUDGET_RANGES.map((b) => [b.value, b.label]));
  return {
    kpis: {
      leads: { value: leadsNow, previous: leadsBefore, delta: delta(leadsNow, leadsBefore) },
      needsAction: { value: needsAction, oldest },
      agencies: { value: published.count ?? 0, claimed: claimed.count ?? 0 },
      seo: { indexable: directory.combos.length, total: totalCombos },
    },
    series,
    attention: groups,
    gaps,
    topAgencies,
    recentLeads: recent.data!.map((l) => ({
      id: l.id,
      name: l.name,
      need: [l.services?.name, l.industries?.name && `for ${l.industries.name}`]
        .filter(Boolean)
        .join(" "),
      budget: l.budget_range ? (budget.get(l.budget_range) ?? l.budget_range) : null,
      routedTo: l.lead_routes.map((r) => r.agencies?.name).filter((n): n is string => !!n),
      createdAt: l.created_at,
    })),
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
