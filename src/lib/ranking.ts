// Directory ranking (ADMIN_V2_SPEC §6), explained publicly on /how-we-rank. Keep the two in sync.
// No imports, so tests load this file directly.
//
// 1. Sponsored slots for the page, by position (max 3), labeled "Sponsored".
// 2. Agencies on a paid plan (Founding or Pro).
// 3. Free agencies.
// Within 2 and 3: quality score (0–100), then name.

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
function responsePoints(minutes: number | null) {
  if (minutes === null) return 0;
  return minutes < 4 * 60 ? 10 : minutes < 24 * 60 ? 7 : minutes < 48 * 60 ? 4 : 0;
}

/**
 * Profile completeness (36) + published reviews (27) + verification (27) + response time (10).
 * The first three are the original 40/30/30 split scaled to 90, so they keep their proportions.
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
  return Math.round(
    (completeness + reviews + verification) * 0.9 + responsePoints(q.responseMinutes),
  );
}

export const MAX_SPONSORED = 3;

export type Rankable = { id: string; name: string; paid: boolean; quality: number };

/**
 * Orders a page's agencies. `sponsoredIds` are the page's active slot holders in position order;
 * holders not on this page's list are skipped.
 */
export function rankAgencies<T extends Rankable>(items: T[], sponsoredIds: string[]) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const sponsored = sponsoredIds
    .filter((id, i, all) => byId.has(id) && all.indexOf(id) === i)
    .slice(0, MAX_SPONSORED)
    .map((id) => ({ ...byId.get(id)!, sponsored: true as const }));
  const taken = new Set(sponsored.map((s) => s.id));
  const rest = items
    .filter((i) => !taken.has(i.id))
    .sort(
      (a, b) =>
        Number(b.paid) - Number(a.paid) || b.quality - a.quality || a.name.localeCompare(b.name),
    )
    .map((i) => ({ ...i, sponsored: false as const }));
  return [...sponsored, ...rest];
}
