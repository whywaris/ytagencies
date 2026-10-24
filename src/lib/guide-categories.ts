// Guide categories: the colour palette, the /guides tabs (a limit, then "More"), when a category
// page is indexed, guide search, and the featured guide. Pure, no imports: tested in
// tests/guide-categories.test.mjs.

/** Brand-safe category colours, each AA (4.5:1+) with white text. Stored by key. */
export const CATEGORY_COLORS = {
  blue: { label: "Blue", hex: "#1F5EFF" },
  violet: { label: "Violet", hex: "#6A4AE6" },
  mint: { label: "Green", hex: "#0B7A5A" },
  coral: { label: "Coral", hex: "#B8391F" },
  amber: { label: "Amber", hex: "#8A5300" },
  pink: { label: "Pink", hex: "#B0275F" },
  slate: { label: "Slate", hex: "#3F4654" },
  teal: { label: "Teal", hex: "#0F6E7A" },
} as const;
export type CategoryColor = keyof typeof CATEGORY_COLORS;
export const COLOR_KEYS = Object.keys(CATEGORY_COLORS) as CategoryColor[];
export const colorHex = (key: string) =>
  (CATEGORY_COLORS as Record<string, { hex: string }>)[key]?.hex ?? CATEGORY_COLORS.blue.hex;

export const DEFAULT_TABS_MAX = 6;
export const MIN_GUIDES_TO_INDEX = 3;
export const GUIDES_PER_PAGE = 12;

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  show_in_tabs: boolean;
};

/** Category slug from its name: "Prices & contracts" → "prices-and-contracts". */
export const categorySlug = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "");

/**
 * The tab row: "All" (added by the page) + at most `max` categories that are set to show as a tab
 * and have a live guide, in their order; every other category with a live guide goes in "More".
 * Categories without live guides appear nowhere.
 */
export function guideTabs<T extends CategoryRow>(
  categories: T[],
  liveCount: (id: string) => number,
  max: number,
) {
  const withGuides = [...categories]
    .filter((c) => liveCount(c.id) > 0)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const tabs = withGuides.filter((c) => c.show_in_tabs).slice(0, Math.max(0, max));
  const shown = new Set(tabs.map((c) => c.id));
  return { tabs, more: withGuides.filter((c) => !shown.has(c.id)) };
}

/** A category page is indexed (and in the sitemap) from 3 live guides. */
export const categoryIndexable = (liveGuides: number) => liveGuides >= MIN_GUIDES_TO_INDEX;

/** A category can be deleted only when no guide (draft or live) uses it. */
export const canDeleteCategory = (guidesUsingIt: number) => guidesUsingIt === 0;

/** Search text: letters, digits and simple punctuation, spaces collapsed, 100 characters. */
export const cleanGuideQuery = (raw: string) =>
  raw
    .replace(/[^A-Za-z0-9À-ɏ\s'&.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .trim();

/** A search or a page past 1 of a filtered view: noindex,follow, canonical /guides. */
export const guidesSearchRobots = (q: string) =>
  q ? { noindex: true, canonical: "/guides" } : { noindex: false, canonical: null };

/** Does a guide match the search? Title, excerpt and body text, case-insensitive, every word. */
export function guideMatches(
  g: { title: string; excerpt: string | null; text: string },
  q: string,
) {
  const hay = `${g.title} ${g.excerpt ?? ""} ${g.text}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

/** The featured guide: the one the admin picked (if live), else the latest. */
export function pickFeatured<T extends { isFeatured: boolean }>(liveNewestFirst: T[]) {
  return liveNewestFirst.find((g) => g.isFeatured) ?? liveNewestFirst[0] ?? null;
}
