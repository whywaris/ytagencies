// Sitemaps and llms.txt: which URLs go in, and the text formats. Pure, no imports: tested in
// tests/sitemap.test.mjs. lib/sitemap.ts loads the data.

export type Entry = { path: string; lastModified?: string | null };

/**
 * Sitemaps and llms.txt: a short CDN cache, so a missed revalidation is at most minutes old.
 * Never immutable.
 */
export const SITEMAP_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

/** The child sitemaps of /sitemap.xml: /sitemaps/<file>.xml. */
export const SITEMAP_FILES = ["pages", "guides", "authors"] as const;
export type SitemapFile = (typeof SITEMAP_FILES)[number];

/** Never in a sitemap: private areas, flows, and anything with a query string. */
const PRIVATE = /^\/(admin|login|auth|api)(\/|$)/;
export const sitemapSafe = (path: string) =>
  path.startsWith("/") && !path.includes("?") && !path.includes("#") && !PRIVATE.test(path);

export const SITEMAP_MAX_URLS = 50_000;
export const sitemapParts = (count: number) => Math.max(1, Math.ceil(count / SITEMAP_MAX_URLS));

/** The later of two ISO dates. */
export const newer = (a: string | null | undefined, b: string) => (a && a > b ? a : b);

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lastmod = (d?: string | null) =>
  d && Number.isFinite(Date.parse(d)) ? `<lastmod>${new Date(d).toISOString()}</lastmod>` : "";

/** A urlset; `absolute` turns a path into the canonical https URL. */
export function urlsetXml(entries: Entry[], absolute: (path: string) => string) {
  const urls = entries
    .filter((e) => sitemapSafe(e.path))
    .map((e) => `  <url><loc>${escapeXml(absolute(e.path))}</loc>${lastmod(e.lastModified)}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls ? `${urls}\n` : ""}</urlset>\n`;
}

/** The sitemap index: one child per file, dated by its newest URL. */
export function indexXml(children: { url: string; lastModified?: string | null }[]) {
  const items = children
    .map((c) => `  <sitemap><loc>${escapeXml(c.url)}</loc>${lastmod(c.lastModified)}</sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

export const newest = (entries: Entry[]) =>
  entries
    .map((e) => e.lastModified)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1) ?? null;

type Link = { title: string; url: string; note?: string | null };

/** One line of plain text from a longer intro: its first sentence, at most ~160 characters. */
export function oneLine(text: string | null | undefined) {
  const first =
    (text ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .split(/(?<=[.!?])\s/)[0] ?? "";
  return first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first;
}

/** llms.txt (llmstxt.org): H1, a one-line summary, a short paragraph, then link sections. */
export function llmsTxt(d: {
  brand: string;
  summary: string;
  about: string;
  guides: Link[];
  pages: Link[];
}) {
  const section = (title: string, links: Link[]) =>
    links.length
      ? `## ${title}\n\n${links.map((l) => `- [${l.title}](${l.url})${l.note ? `: ${l.note}` : ""}`).join("\n")}\n`
      : "";
  return [
    `# ${d.brand}\n`,
    `> ${d.summary}\n`,
    `${d.about}\n`,
    section("Guides", d.guides),
    section("About", d.pages),
  ]
    .filter(Boolean)
    .join("\n");
}
