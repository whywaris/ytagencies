import "server-only";

import { getAgencySlugs, getDirectoryIndex } from "@/lib/data/agencies";
import { getLiveAuthors, getLiveGuides } from "@/lib/data/guides";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { PAGE_UPDATED } from "@/lib/page-dates";
import {
  agencyEntries,
  directoryEntries,
  llmsTxt,
  newest,
  oneLine,
  type Entry,
} from "@/lib/sitemap-core";
import { absoluteUrl, BRAND_NAME, MIN_AGENCIES_TO_INDEX } from "@/lib/site";

// Data for /sitemap.xml, /sitemaps/<file>.xml and /llms.txt (docs/SEO.md). Indexable pages only,
// by the same rules the pages use for their robots meta (lib/sitemap-core.ts).

export const SITEMAP_FILES = [
  "pages",
  "services",
  "combos",
  "locations",
  "agencies",
  "guides",
  "authors",
] as const;
export type SitemapFile = (typeof SITEMAP_FILES)[number];

export async function sitemapEntries(file: SitemapFile): Promise<Entry[]> {
  switch (file) {
    case "pages": {
      const [{ siteLastModified }, guides] = await Promise.all([
        getDirectoryIndex(),
        getLiveGuides(),
      ]);
      // Pages whose content we date; the rest have no lastmod rather than a made-up one.
      return [
        { path: "/", lastModified: siteLastModified },
        {
          path: "/guides",
          lastModified: newest(guides.map((g) => ({ path: "", lastModified: g.updatedAt }))),
        },
        { path: "/get-matched" },
        { path: "/list-your-agency" },
        { path: "/for-agencies/pricing" },
        { path: "/how-we-rank" },
        { path: "/about" },
        { path: "/contact" },
        ...Object.entries(PAGE_UPDATED).map(([path, lastModified]) => ({ path, lastModified })),
      ];
    }
    case "services": {
      const [{ hubs }, services] = await Promise.all([getDirectoryIndex(), getServices()]);
      return services.map((s) => ({ path: `/${s.slug}`, lastModified: hubs.get(s.slug) }));
    }
    case "combos":
    case "locations":
      return directoryEntries(
        await directoryPages(),
        MIN_AGENCIES_TO_INDEX,
        file === "combos" ? "for" : "in",
      );
    case "agencies":
      return agencyEntries(await getAgencySlugs());
    case "guides":
      return (await getLiveGuides()).map((g) => ({
        path: `/guides/${g.slug}`,
        lastModified: g.updatedAt,
      }));
    case "authors":
      // Author pages only exist for authors with live guides.
      return (await getLiveAuthors()).map((a) => ({
        path: `/authors/${a.slug}`,
        lastModified: a.updated_at,
      }));
  }
}

/** Every directory page with its agency count; dates include page copy changes where known. */
async function directoryPages() {
  const { pages, combos } = await getDirectoryIndex();
  const dated = new Map(combos.map((c) => [`${c.serviceSlug}|${c.segment}`, c.lastModified]));
  return [...pages].map(([key, p]) => {
    const [serviceSlug, segment] = key.split("|");
    return { serviceSlug, segment, count: p.count, lastModified: dated.get(key) ?? p.lastModified };
  });
}

/** /llms.txt: facts the site actually implements, and links to indexable pages only. */
export async function buildLlmsTxt() {
  const [services, industries, pages, guides] = await Promise.all([
    getServices(),
    getIndustries(),
    directoryPages(),
    getLiveGuides(),
  ]);
  // Indexable service × industry pages, busiest first.
  const indexable = pages
    .filter((p) => p.count >= MIN_AGENCIES_TO_INDEX && p.segment.startsWith("for-"))
    .sort((a, b) => b.count - a.count || a.serviceSlug.localeCompare(b.serviceSlug));
  const combos = directoryEntries(indexable, MIN_AGENCIES_TO_INDEX, "for");
  const byPath = new Map(indexable.map((p) => [`/${p.serviceSlug}/${p.segment}`, p.count]));
  combos.sort((a, b) => (byPath.get(b.path) ?? 0) - (byPath.get(a.path) ?? 0));
  const serviceName = new Map(services.map((s) => [s.slug, s.name]));
  const industryName = new Map(industries.map((i) => [i.slug, i.name]));
  // Industries have no page of their own: each links to its best indexable service page.
  const industryLinks = industries.flatMap((i) => {
    const best = indexable.find((p) => p.segment === `for-${i.slug}`);
    return best
      ? [
          {
            title: i.name,
            url: absoluteUrl(`/${best.serviceSlug}/${best.segment}`),
            note: oneLine(i.intro) || null,
          },
        ]
      : [];
  });
  const comparisons = combos.slice(0, 30).map((c) => {
    const [, service, segment] = c.path.split("/");
    const industry = industryName.get(segment.replace(/^for-/, "")) ?? segment;
    return {
      title: `${serviceName.get(service) ?? service} agencies for ${industry}`,
      url: absoluteUrl(c.path),
    };
  });

  return llmsTxt({
    brand: BRAND_NAME,
    summary:
      "An independent directory that helps businesses find and compare YouTube agencies by service, industry and location.",
    about: [
      `Businesses use ${BRAND_NAME} for free: they browse agencies by service, industry and location, or describe what they need and get matched with up to three agencies.`,
      "Listings are free and can be created by us from public information or submitted by agencies. Agencies can manage their profile, receive inquiries and link to their website with a paid Pro plan.",
      "Directory order is sponsored placements first (always labelled Sponsored), then agencies on Pro, then other listings, each sorted by a quality score from profile completeness, reviews, verification and reply time. The Verified badge can't be bought: it's given after we check an agency's YouTube channels, website and business.",
      "Subscriber counts for the channels on a profile come from the YouTube Data API; a channel an agency adds shows as listed by the agency until the channel owner confirms the work to us.",
      `${BRAND_NAME} is not affiliated with YouTube or Google.`,
    ].join(" "),
    services: services.map((s) => ({
      title: `${s.name} agencies`,
      url: absoluteUrl(`/${s.slug}`),
      note: oneLine(s.intro) || `Compare agencies that offer ${s.name}.`,
    })),
    industries: industryLinks,
    comparisons,
    guides: guides.map((g) => ({
      title: g.title,
      url: absoluteUrl(`/guides/${g.slug}`),
      note: oneLine(g.description || g.excerpt),
    })),
    pages: [
      { title: "About", url: absoluteUrl("/about") },
      { title: "How we rank agencies", url: absoluteUrl("/how-we-rank") },
      { title: "Contact", url: absoluteUrl("/contact") },
      { title: "Privacy policy", url: absoluteUrl("/privacy") },
      { title: "Terms", url: absoluteUrl("/terms") },
    ],
  });
}
