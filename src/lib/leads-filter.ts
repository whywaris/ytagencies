import "server-only";

import { BUDGET_RANGES } from "@/lib/validation/lead";

// Leads filters (ADMIN_V2_SPEC §5.5), shared by the admin leads table and its CSV export so the
// export is exactly "the current filter". Everything comes from the URL, so it's validated here.

export type LeadFilters = {
  service: string;
  industry: string;
  budget: string;
  from: string; // yyyy-mm-dd, inclusive
  to: string; // yyyy-mm-dd, inclusive
  q: string; // email or company
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9-]{1,80}$/;

export function parseLeadFilters(sp: Params): LeadFilters {
  return {
    service: SLUG.test(one(sp.service)) ? one(sp.service) : "",
    industry: SLUG.test(one(sp.industry)) ? one(sp.industry) : "",
    budget: BUDGET_RANGES.some((b) => b.value === one(sp.budget)) ? one(sp.budget) : "",
    from: DATE.test(one(sp.from)) ? one(sp.from) : "",
    to: DATE.test(one(sp.to)) ? one(sp.to) : "",
    // Only characters that can't break PostgREST's or() syntax or act as LIKE wildcards.
    q: one(sp.q)
      .replace(/[^\p{L}\p{N} @.+'-]/gu, " ")
      .trim()
      .slice(0, 100),
  };
}

/** The filters as URL params, without empty ones. */
export function leadFilterParams(f: LeadFilters) {
  return new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
}

type Filterable<Q> = {
  eq(column: string, value: string | number): Q;
  gte(column: string, value: string): Q;
  lt(column: string, value: string): Q;
  or(filters: string): Q;
};

/** Applies the filters to a leads query. Unknown service/industry slugs match nothing. */
export function applyLeadFilters<Q extends Filterable<Q>>(
  query: Q,
  f: LeadFilters,
  ids: { serviceId?: number; industryId?: number },
): Q {
  let q = query;
  if (f.service) q = q.eq("service_id", ids.serviceId ?? -1);
  if (f.industry) q = q.eq("industry_id", ids.industryId ?? -1);
  if (f.budget) q = q.eq("budget_range", f.budget);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00Z`);
  if (f.to) {
    const next = new Date(`${f.to}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    q = q.lt("created_at", next.toISOString());
  }
  if (f.q) q = q.or(`email.ilike.*${f.q}*,company.ilike.*${f.q}*`);
  return q;
}
