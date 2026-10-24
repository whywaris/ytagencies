// Sitemaps and llms.txt: which URLs go in, and the text formats. Pure, no imports: tested in
// tests/sitemap.test.mjs, which feeds it the same rules the pages use for their robots meta
// (thinProfileMissing for agency profiles, MIN_AGENCIES_TO_INDEX for directory pages), so the
// sitemap and noindex can't disagree. lib/sitemap.ts loads the data.

export type Entry = { path: string; lastModified?: string | null };

/**
 * Sitemaps and llms.txt: a short CDN cache, so a missed revalidation is at most minutes old.
 * Never immutable.
 */
export const SITEMAP_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

/** The child sitemaps of /sitemap.xml: /sitemaps/<file>.xml. */
export const SITEMAP_FILES = [
  "pages",
  "services",
  "industries",
  "locations",
  "combos",
  "service-locations",
  "service-industry-locations",
  "agencies",
  "guides",
  "authors",
] as const;
export type SitemapFile = (typeof SITEMAP_FILES)[number];

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

/** A published agency, as the directory counts it. */
export type PublishedAgency = {
  updatedAt: string;
  services: string[];
  industries: string[];
  locationIds: number[];
};

/**
 * One pass over published agencies: how many are on each service × industry / service × location
 * page ("service|segment") and each service hub, and when each last changed (newest agency
 * updated_at). A location page counts its cities too, matching resolveSegment(). Unpublishing an
 * agency removes it from the input, so its pages lose it straight away.
 */
export function countDirectoryPages(
  agencies: PublishedAgency[],
  locations: { id: number; slug: string; parentId: number | null }[],
) {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const pages = new Map<string, { count: number; lastModified: string }>();
  // Every directory page by path (all page types), for the sitemaps, links and Admin → SEO pages.
  const paths = new Map<string, { count: number; lastModified: string }>();
  const bump = (path: string, at: string) => {
    const page = paths.get(path);
    paths.set(path, {
      count: (page?.count ?? 0) + 1,
      lastModified: newer(page?.lastModified ?? null, at),
    });
  };
  const hubs = new Map<string, string>(); // service slug -> lastModified
  const hubCounts = new Map<string, number>(); // service slug -> published agencies
  let siteLastModified: string | null = null;

  for (const agency of agencies) {
    siteLastModified = newer(siteLastModified, agency.updatedAt);
    const segments = new Set(agency.industries.map((i) => `for-${i}`));
    // Location hubs (/locations/<country>[/<city>]) and countries, for the triple pages.
    const places = new Set<string>();
    const countries = new Set<string>();
    for (const id of agency.locationIds) {
      const loc = byId.get(id);
      if (!loc) continue;
      segments.add(`in-${loc.slug}`);
      const parent = loc.parentId ? byId.get(loc.parentId) : undefined;
      if (parent) {
        segments.add(`in-${parent.slug}`);
        places.add(`/locations/${parent.slug}`);
        places.add(`/locations/${parent.slug}/${loc.slug}`);
        countries.add(parent.slug);
      } else {
        places.add(`/locations/${loc.slug}`);
        countries.add(loc.slug);
      }
    }
    for (const industry of agency.industries) bump(`/industries/${industry}`, agency.updatedAt);
    for (const place of places) bump(place, agency.updatedAt);
    for (const service of agency.services) {
      bump(`/${service}`, agency.updatedAt);
      for (const segment of segments) bump(`/${service}/${segment}`, agency.updatedAt);
      for (const industry of agency.industries)
        for (const country of countries)
          bump(`/${service}/for-${industry}/in-${country}`, agency.updatedAt);
      hubs.set(service, newer(hubs.get(service) ?? null, agency.updatedAt));
      hubCounts.set(service, (hubCounts.get(service) ?? 0) + 1);
      for (const segment of segments) {
        const key = `${service}|${segment}`;
        const page = pages.get(key);
        pages.set(key, {
          count: (page?.count ?? 0) + 1,
          lastModified: newer(page?.lastModified ?? null, agency.updatedAt),
        });
      }
    }
  }
  return { pages, paths, hubs, hubCounts, siteLastModified };
}

/** What kind of directory page a path is (the sitemap files and Admin → SEO pages). */
export type PageType =
  | "service"
  | "industry"
  | "location"
  | "service-industry"
  | "service-location"
  | "service-industry-location";

export function pageTypeOf(path: string): PageType {
  if (path.startsWith("/industries/")) return "industry";
  if (path.startsWith("/locations/")) return "location";
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 1) return "service";
  if (parts.length === 3) return "service-industry-location";
  return parts[1].startsWith("for-") ? "service-industry" : "service-location";
}

/** Live pages of one type: the 3-agency rule, sorted by path, with their real lastmod. */
export function livePagesOf(
  paths: Map<string, { count: number; lastModified: string }>,
  type: PageType,
  minAgencies: number,
): Entry[] {
  return [...paths]
    .filter(([path, p]) => p.count >= minAgencies && pageTypeOf(path) === type && sitemapSafe(path))
    .map(([path, p]) => ({ path, lastModified: p.lastModified }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Sitemaps hold at most 50,000 URLs: a file with more is split into numbered parts. */
export const SITEMAP_MAX_URLS = 50_000;
export const sitemapParts = (count: number) => Math.max(1, Math.ceil(count / SITEMAP_MAX_URLS));

/** The later of two ISO dates. */
export const newer = (a: string | null | undefined, b: string) => (a && a > b ? a : b);

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
  locations: Link[];
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
    section("Locations", d.locations),
    section("Guides", d.guides),
    section("About", d.pages),
  ]
    .filter(Boolean)
    .join("\n");
}

/** The path a link points at, without query or hash (how the sitemap lists it). */
const pathOf = (href: string) => href.replace(/[?#].*$/, "");

/**
 * Internal-linking blocks link only to live, indexable pages: the ones the sitemap lists
 * (`live` = every sitemap path). Anything else (noindex, thin, empty, draft) is dropped.
 */
export const liveOnly = <T extends { href: string }>(links: T[], live: ReadonlySet<string>) =>
  links.filter((l) => live.has(pathOf(l.href)));

/**
 * "Explore more" chips from the page index: live pages only (the 3-agency rule, as in the
 * sitemap), each with its agency count. `pick` names the paths to link (null skips one).
 */
export function liveLinks(
  paths: Map<string, { count: number }>,
  minAgencies: number,
  pick: (path: string) => { label: string; title: string } | null,
) {
  return [...paths].flatMap(([href, p]) => {
    if (p.count < minAgencies) return [];
    const named = pick(href);
    return named ? [{ href, ...named, count: p.count }] : [];
  });
}
