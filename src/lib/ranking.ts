// Directory ranking (ADMIN_V2_SPEC §6), explained publicly on /how-we-rank. Keep the two in sync.
// No imports, so tests load this file directly.
//
// 1. Verified + Pro. 2. Pro. 3. Verified (free). 4. Everyone else.
// Within each: quality score (0–100), then name. Pro agencies always carry the Pro badge;
// Verified is earned and can't be bought. Sponsored slots (labelled, before every group) exist but
// are switched off unless SPONSORED_ENABLED=true; their data and tables are kept.

export type QualityInput = {
  hasLogo: boolean;
  hasTagline: boolean;
  descriptionLength: number;
  hasMinBudget: boolean;
  caseStudies: number;
  locations: number;
  reviews: { count: number; average: number } | null;
  /** Approved verification; `withStats` when its YouTube channel stats were checked. */
  verification: "none" | "approved" | "withStats";
  /** Median minutes to contact a lead (agency_response_times); null without enough data. */
  responseMinutes: number | null;
};

/** Response time points (max 10): under 4 hours, a day, two days. */
function responsePoints(minutes: number) {
  return minutes < 4 * 60 ? 10 : minutes < 24 * 60 ? 7 : minutes < 48 * 60 ? 4 : 0;
}

/**
 * Profile completeness (36) + published reviews (27) + verification (27) + response time (10).
 * The first three are the original 40/30/30 split scaled to 90, so they keep their proportions.
 * Response time needs data (3+ contacted inquiries in 90 days); without it (always the case for
 * free listings, which can't receive inquiries) the other 90 points are scaled to 100, so nobody
 * is marked down for a number they can't have.
 */
export function qualityScore(q: QualityInput) {
  const completeness =
    (q.hasLogo ? 5 : 0) +
    (q.hasTagline ? 5 : 0) +
    (q.descriptionLength >= 200 ? 10 : q.descriptionLength >= 50 ? 5 : 0) +
    (q.hasMinBudget ? 5 : 0) +
    (q.caseStudies > 0 ? 10 : 0) +
    (q.locations > 0 ? 5 : 0);
  const reviews = q.reviews
    ? Math.min(q.reviews.count, 10) * 1.5 + (q.reviews.average / 5) * 15
    : 0;
  const verification = q.verification === "withStats" ? 30 : q.verification === "approved" ? 15 : 0;
  const base = (completeness + reviews + verification) * 0.9;
  return Math.round(
    q.responseMinutes === null ? (base * 100) / 90 : base + responsePoints(q.responseMinutes),
  );
}

export const MAX_SPONSORED = 3;

/** Sponsored slots are off unless SPONSORED_ENABLED is exactly "true". */
export const sponsoredEnabled = (env: Record<string, string | undefined> = process.env) =>
  env.SPONSORED_ENABLED?.trim() === "true";

/** When these rules last changed (yyyy-mm-dd): /how-we-rank "Last updated" and dateModified. */
export const RANKING_UPDATED = "2026-10-24";

export type Rankable = {
  id: string;
  name: string;
  isVerified: boolean;
  /** Live Pro (lib/entitlements.ts proBadge). */
  managed: boolean;
  quality: number;
};

/** 0 = Verified + Pro, 1 = Pro, 2 = Verified, 3 = everyone else. */
export const rankGroup = (a: Pick<Rankable, "isVerified" | "managed">) =>
  a.managed ? (a.isVerified ? 0 : 1) : a.isVerified ? 2 : 3;

/** The directory order: group, then quality score, then name. */
export const byMerit = (a: Rankable, b: Rankable) =>
  rankGroup(a) - rankGroup(b) || b.quality - a.quality || a.name.localeCompare(b.name);

/**
 * Orders a page's agencies. `sponsoredIds` are the page's active slot holders in position order;
 * holders not on this page's list are skipped, and all of them while Sponsored is off.
 */
export function rankAgencies<T extends Rankable>(
  items: T[],
  sponsoredIds: string[],
  sponsoredOn = sponsoredEnabled(),
) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const sponsored = (sponsoredOn ? sponsoredIds : [])
    .filter((id, i, all) => byId.has(id) && all.indexOf(id) === i)
    .slice(0, MAX_SPONSORED)
    .map((id) => ({ ...byId.get(id)!, sponsored: true as const }));
  const taken = new Set(sponsored.map((s) => s.id));
  const rest = items
    .filter((i) => !taken.has(i.id))
    .sort(byMerit)
    .map((i) => ({ ...i, sponsored: false as const }));
  return [...sponsored, ...rest];
}
