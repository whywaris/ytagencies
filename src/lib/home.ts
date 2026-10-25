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
  /** Passes the thin-profile rule (lib/profile-seo.ts). */
  indexable?: boolean;
  /** Logo, description and 2+ services: good enough to show while few are Verified. */
  complete?: boolean;
};

/** lib/ranking.ts rankGroup, repeated here to keep this file import-free (tested to match). */
const group = (a: Pickable) => (a.managed ? (a.isVerified ? 0 : 1) : a.isVerified ? 2 : 3);

/**
 * Agencies for the home page ("Agencies to compare"), never empty while any agency is published:
 *  - 3+ Verified: the directory's ranking over indexable profiles (Verified + Pro, Pro, Verified,
 *    everyone else; then profile views, quality score, name).
 *  - Otherwise: the most complete profiles (logo, description, 2+ services) by quality score,
 *    topped up by quality score when fewer than 3 are complete.
 * At most one sponsored card first. 6 cards when there are 6, else 3 (or all, under 3).
 */
export function pickHomeAgencies<T extends Pickable>(
  agencies: T[],
  { sponsoredIds, views }: { sponsoredIds: string[]; views: Record<string, number> },
): (T & { sponsored: boolean })[] {
  const byQuality = (a: T, b: T) => b.quality - a.quality || a.name.localeCompare(b.name);
  const indexable = agencies.filter((a) => a.indexable !== false);
  const ranked =
    agencies.filter((a) => a.isVerified).length >= 3 && indexable.length >= 3
      ? [...indexable].sort(
          (a, b) =>
            group(a) - group(b) || (views[b.id] ?? 0) - (views[a.id] ?? 0) || byQuality(a, b),
        )
      : [...agencies].sort(
          (a, b) => Number(b.complete ?? false) - Number(a.complete ?? false) || byQuality(a, b),
        );
  const sponsored = sponsoredIds
    .map((id) => agencies.find((a) => a.id === id))
    .find((a): a is T => !!a);
  const all = [
    ...(sponsored ? [{ ...sponsored, sponsored: true }] : []),
    ...ranked.filter((a) => a.id !== sponsored?.id).map((a) => ({ ...a, sponsored: false })),
  ];
  return all.slice(0, all.length >= 6 ? 6 : 3);
}

/**
 * Industry tiles: industries whose hub has at least `min` published agencies, most first (up to
 * 12). Fewer than 4 qualify: none (the section hides rather than show a lone chip).
 */
export function industryTiles<T extends { slug: string }>(
  industries: T[],
  hubCounts: Map<string, number>,
  min = 3,
) {
  const tiles = industries
    .filter((i) => (hubCounts.get(i.slug) ?? 0) >= min)
    .sort((a, b) => hubCounts.get(b.slug)! - hubCounts.get(a.slug)!)
    .slice(0, 12);
  return tiles.length >= 4 ? tiles : [];
}

/** Guides section layout: one wide card, two columns, or a grid of three. */
export const guideLayout = (n: number) => (n <= 1 ? "featured" : n === 2 ? "two" : "three");

/** "940+ YouTube agencies · 10 services · 31 countries · Free for businesses" (live counts). */
export function statsLine({
  agencies,
  services,
  countries,
}: {
  agencies: number;
  services: number;
  countries: number;
}) {
  const n = agencies >= 10 ? `${Math.floor(agencies / 10) * 10}+` : String(agencies);
  const plural = (k: number, one: string, many: string) => (k === 1 ? one : many);
  return [
    `${n} YouTube ${plural(agencies, "agency", "agencies")}`,
    `${services} ${plural(services, "service", "services")}`,
    ...(countries > 0 ? [`${countries} ${plural(countries, "country", "countries")}`] : []),
    "Free for businesses",
  ].join(" · ");
}

/**
 * "Typical start" for a service card: the median starting price among the most common pricing
 * model, shown only when at least 5 published agencies with that model have a price (prices in
 * different units can't share a median). null: show nothing.
 */
export function typicalStart(prices: { usd: number | null; model: string | null }[], min = 5) {
  const byModel = new Map<string, number[]>();
  for (const p of prices)
    if (p.usd !== null && p.usd > 0 && p.model)
      byModel.set(p.model, [...(byModel.get(p.model) ?? []), p.usd]);
  const [model, list] = [...byModel].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (!model || list.length < min) return null;
  const sorted = [...list].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const usd = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { usd, model };
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
