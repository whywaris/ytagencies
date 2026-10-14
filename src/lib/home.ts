// Home page rules: where the finder goes, which combos are "popular", which agencies are shown.
// Pure, no imports: tested (tests/home.test.mjs).

/** Agency count per "service|for-industry" (every combo with at least one agency). */
export type ComboCounts = Record<string, number>;

/**
 * Finder target: the service × industry page when it's live (indexable), else the service page
 * filtered to that industry when it has agencies there, else Get matched prefilled with both.
 */
export function finderHref(
  service: string,
  industry: string,
  counts: ComboCounts,
  minToIndex: number,
) {
  const n = counts[`${service}|for-${industry}`] ?? 0;
  if (n >= minToIndex) return `/${service}/for-${industry}`;
  if (n > 0) return `/${service}?industry=${industry}`;
  const q = new URLSearchParams({ service, industry, ref: "home" });
  return `/get-matched?${q}`;
}

export type LiveCombo = { serviceSlug: string; segment: string; count: number };

/** Live service × industry pages, most agencies first (ties keep their order). */
export function popularIndustryCombos(combos: LiveCombo[], limit: number, serviceSlug?: string) {
  return combos
    .filter((c) => c.segment.startsWith("for-") && (!serviceSlug || c.serviceSlug === serviceSlug))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

type Pickable = { id: string; name: string; isVerified: boolean; quality: number };

/**
 * Agencies for the home page: at most one sponsored card first, then by profile views (last 30
 * days), then the directory's merit order (lib/ranking.ts byMerit: verified, quality score, name;
 * Pro plays no part). Fewer than `min` means the section is hidden: [].
 */
export function pickHomeAgencies<T extends Pickable>(
  agencies: T[],
  {
    sponsoredIds,
    views,
    limit = 6,
    min = 3,
  }: {
    sponsoredIds: string[];
    views: Record<string, number>;
    limit?: number;
    min?: number;
  },
): (T & { sponsored: boolean })[] {
  const sponsored = sponsoredIds
    .map((id) => agencies.find((a) => a.id === id))
    .find((a): a is T => !!a);
  const rest = agencies
    .filter((a) => a.id !== sponsored?.id)
    .sort(
      (a, b) =>
        (views[b.id] ?? 0) - (views[a.id] ?? 0) ||
        Number(b.isVerified) - Number(a.isVerified) ||
        b.quality - a.quality ||
        a.name.localeCompare(b.name),
    );
  const picked = [
    ...(sponsored ? [{ ...sponsored, sponsored: true }] : []),
    ...rest.map((a) => ({ ...a, sponsored: false })),
  ].slice(0, limit);
  return picked.length >= min ? picked : [];
}
