// Home page rules: where the finder goes, which combos are "popular", which agencies are shown.
// Pure, no imports: tested (tests/home.test.mjs).

/** Agency count per "service|for-industry" (every combo with at least one agency). */
export type ComboCounts = Record<string, number>;

/**
 * Finder target: the service × industry page when it's live (indexable), else the service page
 * filtered to that industry when it has agencies there, else Request proposals prefilled with both.
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
  return `/request-proposals?${q}`;
}

export type LiveCombo = { serviceSlug: string; segment: string; count: number };

/** Live service × industry pages, most agencies first (ties keep their order). */
export function popularIndustryCombos(combos: LiveCombo[], limit: number, serviceSlug?: string) {
  return combos
    .filter((c) => c.segment.startsWith("for-") && (!serviceSlug || c.serviceSlug === serviceSlug))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

type Pickable = {
  id: string;
  name: string;
  isVerified: boolean;
  managed: boolean;
  quality: number;
};

/** lib/ranking.ts rankGroup, repeated here to keep this file import-free (tested to match). */
const group = (a: Pickable) => (a.managed ? (a.isVerified ? 0 : 1) : a.isVerified ? 2 : 3);

/**
 * Agencies for the home page: at most one sponsored card first, then the directory's groups
 * (lib/ranking.ts: Verified + Pro, Pro, Verified, everyone else), within each by profile views
 * (last 30 days), then quality score and name. Fewer than `min` means the section is hidden: [].
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
        group(a) - group(b) ||
        (views[b.id] ?? 0) - (views[a.id] ?? 0) ||
        b.quality - a.quality ||
        a.name.localeCompare(b.name),
    );
  const picked = [
    ...(sponsored ? [{ ...sponsored, sponsored: true }] : []),
    ...rest.map((a) => ({ ...a, sponsored: false })),
  ].slice(0, limit);
  return picked.length >= min ? picked : [];
}

/** UTC date as YYYY-MM-DD: the home page's daily seed. */
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/**
 * `n` items picked by a shuffle seeded from `seed` (the UTC day): the same pick for everyone all
 * day, a new one the next day. Items should come in a stable order (e.g. by slug). FNV-1a hash
 * for the seed, mulberry32 for the shuffle; nothing random at request time.
 */
export function dailyPick<T>(items: T[], seed: string, n: number): T[] {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  let s = h >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, n);
}
