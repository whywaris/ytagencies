// Sitemaps and llms.txt: which URLs go in, and the text formats. Pure, no imports: tested in
// tests/sitemap.test.mjs, which feeds it the same rules the pages use for their robots meta
// (thinProfileMissing for agency profiles, MIN_AGENCIES_TO_INDEX for directory pages), so the
// sitemap and noindex can't disagree. lib/sitemap.ts loads the data.

export type Entry = { path: string; lastModified?: string | null };

/** Never in a sitemap: private areas, flows, and anything with a query string. */
const PRIVATE = /^\/(dashboard|admin|login|auth|claim|api|no-access)(\/|$)/;
export const sitemapSafe = (path: string) =>
  path.startsWith("/") && !path.includes("?") && !path.includes("#") && !PRIVATE.test(path);

/** Agency profiles: published only (the caller's query), and not thin (nothing missing). */
export function agencyEntries(rows: { slug: string; updatedAt: string; missing: string[] }[]) {
  return rows
    .filter((a) => a.missing.length === 0)
    .map((a) => ({ path: `/agency/${a.slug}`, lastModified: a.updatedAt }))
    .filter((e) => sitemapSafe(e.path));
}

type DirectoryPage = { serviceSlug: string; segment: string; count: number; lastModified: string };

/** Service × industry (for-) and service × location (in-) pages with enough agencies. */
export function directoryEntries(pages: DirectoryPage[], minAgencies: number, kind: "for" | "in") {
  return pages
    .filter((p) => p.count >= minAgencies && p.segment.startsWith(`${kind}-`))
    .map((p) => ({ path: `/${p.serviceSlug}/${p.segment}`, lastModified: p.lastModified }))
    .filter((e) => sitemapSafe(e.path))
    .sort((a, b) => a.path.localeCompare(b.path));
}

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
  services: Link[];
  industries: Link[];
  comparisons: Link[];
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
    section("Services", d.services),
    section("Industries", d.industries),
    section("Popular comparisons", d.comparisons),
    section("Guides", d.guides),
    section("About", d.pages),
  ]
    .filter(Boolean)
    .join("\n");
}
