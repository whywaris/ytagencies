// Guide rules shared by the editor and the server: the pre-publish check, and the Alternatives
// template (category "alternatives"). No imports: tested (tests/guide-editor.test.mjs).

export const ALTERNATIVES_SLUG = "alternatives";
export const isAlternatives = (categorySlug: string | null | undefined) =>
  categorySlug === ALTERNATIVES_SLUG;

/** Which sidebar panel fixes an item (the check links to it). */
export type Panel = "status" | "category" | "cover" | "excerpt" | "seo" | "related" | "content";

export type CheckItem = { key: string; label: string; blocking: boolean; panel: Panel };

export type CheckInput = {
  categoryId: string | null;
  categorySlug: string | null;
  excerpt: string;
  coverPath: string | null;
  coverAlt: string;
  seoDescription: string;
  pricesCheckedOn: string | null;
  hasText: boolean;
  imagesWithoutAlt: number;
  /** "[price]"-style placeholders still in the text. */
  placeholders: number;
};

/**
 * What's left before publishing. Blocking: no text, no category, images without alt text and, for
 * Alternatives, no "Prices checked on" date. The rest are warnings.
 */
export function prePublishChecks(i: CheckInput): CheckItem[] {
  const items: CheckItem[] = [];
  if (!i.hasText) items.push({ key: "text", label: "Write the guide", blocking: true, panel: "content" });
  if (!i.categoryId) items.push({ key: "category", label: "Choose a category", blocking: true, panel: "category" });
  if (isAlternatives(i.categorySlug) && !i.pricesCheckedOn)
    items.push({ key: "prices", label: "Add the date prices were checked", blocking: true, panel: "category" });
  if (i.imagesWithoutAlt)
    items.push({
      key: "image-alt",
      label: `Add alt text to ${i.imagesWithoutAlt === 1 ? "1 image" : `${i.imagesWithoutAlt} images`}`,
      blocking: true,
      panel: "content",
    });
  if (!i.excerpt.trim()) items.push({ key: "excerpt", label: "Write an excerpt", blocking: false, panel: "excerpt" });
  if (i.coverPath && !i.coverAlt.trim())
    items.push({ key: "cover-alt", label: "Add cover alt text", blocking: false, panel: "cover" });
  if (!i.seoDescription.trim())
    items.push({ key: "seo-description", label: "Write an SEO description", blocking: false, panel: "seo" });
  if (i.placeholders)
    items.push({
      key: "placeholders",
      label: `Fill in ${i.placeholders === 1 ? "1 [placeholder]" : `${i.placeholders} [placeholders]`}`,
      blocking: false,
      panel: "content",
    });
  return items;
}

/** "5 Best Fiverr Alternatives for Hiring…" → "Fiverr alternatives" (the breadcrumb). */
export function shortTitle(title: string) {
  const m = title.match(/(?:best\s+)?([A-Z0-9][\w.&' -]{0,40}?)\s+alternatives\b/i);
  if (m) return `${m[1].replace(/^\d+\s+(best\s+)?/i, "").trim()} alternatives`;
  return title.length > 48 ? `${title.slice(0, 45).trim()}…` : title;
}

/** The Alternatives disclosure, always under the byline. */
export const alternativesDisclosure = (checkedOn: string) =>
  `Disclosure: YT Agencies is our product. We list it first and say so. Prices for the other platforms come from their public pricing pages, checked ${checkedOn}.`;

/** "2026-10-24" → "October 24, 2026" (UTC, so the date never shifts). */
export const longDateOf = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/** The guide byline's date: "Oct. 25, 2026", "May 3, 2026" (UTC, so the date never shifts). */
export function bylineDate(iso: string) {
  const d = new Date(iso);
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${month === "May" ? month : `${month}.`} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
