import "server-only";

import { getAgencySlugs, getDirectoryIndex } from "@/lib/data/agencies";
import { getLiveAuthors, getLiveGuides } from "@/lib/data/guides";
import { getIndustries, getLocations, getServices } from "@/lib/data/taxonomy";
import { PAGE_UPDATED } from "@/lib/page-dates";
import {
  agencyEntries,
  directoryEntries,
  livePagesOf,
  llmsTxt,
  newest,
  oneLine,
  SITEMAP_FILES,
  type Entry,
  type SitemapFile,
} from "@/lib/sitemap-core";
import { BRAND_NAME, INDEPENDENT_DIRECTORY, MIN_AGENCIES_TO_INDEX, absoluteUrl } from "@/lib/site";

// Data for /sitemap.xml, /sitemaps/<file>.xml and /llms.txt (docs/SEO.md). Indexable pages only,
// by the same rules the pages use for their robots meta (lib/sitemap-core.ts).

export { SITEMAP_FILES, type SitemapFile };

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
        { path: "/agencies", lastModified: siteLastModified },
        { path: "/request-proposals" },
        { path: "/list-your-agency" },
        { path: "/pricing" },
        { path: "/how-we-rank" },
        { path: "/about" },
        { path: "/contact" },
        ...Object.entries(PAGE_UPDATED).map(([path, lastModified]) => ({ path, lastModified })),
      ];
    }
    case "services": {
      const [{ hubs, hubCounts }, services] = await Promise.all([
        getDirectoryIndex(),
        getServices(),
      ]);
      // Thin-page rule (docs/SEO.md): a hub is listed once it has enough published agencies.
      return services
        .filter((s) => (hubCounts.get(s.slug) ?? 0) >= MIN_AGENCIES_TO_INDEX)
        .map((s) => ({ path: `/${s.slug}`, lastModified: hubs.get(s.slug) }));
    }
    case "industries":
    case "locations":
    case "service-industry-locations":
      // Industry hubs, country and city hubs, service × industry × country: the 3-agency rule.
      return livePagesOf(
        (await getDirectoryIndex()).paths,
        file === "industries"
          ? "industry"
          : file === "locations"
            ? "location"
            : "service-industry-location",
        MIN_AGENCIES_TO_INDEX,
      );
    case "combos":
    case "service-locations":
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

/** /llms.txt: facts the site actually implements, and links to its live hub pages only. */
export async function buildLlmsTxt() {
  const [allServices, industries, locations, guides, { hubCounts, paths }] = await Promise.all([
    getServices(),
    getIndustries(),
    getLocations(),
    getLiveGuides(),
    getDirectoryIndex(),
  ]);
  const live = (path: string) => (paths.get(path)?.count ?? 0) >= MIN_AGENCIES_TO_INDEX;
  const services = allServices.filter((s) => (hubCounts.get(s.slug) ?? 0) >= MIN_AGENCIES_TO_INDEX);
  const industryLinks = industries
    .filter((i) => live(`/industries/${i.slug}`))
    .map((i) => ({
      title: `YouTube agencies for ${i.name}`,
      url: absoluteUrl(`/industries/${i.slug}`),
      note: oneLine(i.intro) || null,
    }));
  const countryLinks = locations
    .filter((l) => l.type === "country" && live(`/locations/${l.slug}`))
    .map((l) => ({
      title: `YouTube agencies in ${l.name}`,
      url: absoluteUrl(`/locations/${l.slug}`),
    }));

  return llmsTxt({
    brand: BRAND_NAME,
    summary:
      "An independent directory that helps businesses and creators find and compare YouTube agencies by service, industry and location.",
    about: [
      `Businesses and creators use ${BRAND_NAME} for free: they browse agencies by service, industry and location, or describe their project and request proposals from up to three agencies that fit.`,
      "Listings are free and can be created by us from public information or submitted by agencies. Agencies can manage their profile, receive inquiries and link to their website with a paid Pro plan.",
      "Directory order is Verified agencies first, then everyone else, each sorted by a quality score from profile completeness, reviews, verification and reply time. Paying for Pro doesn't change the order. The Verified badge can't be bought: it's given after we check an agency's YouTube channels, website and business.",
      "Subscriber counts for the channels on a profile come from the YouTube Data API; a channel an agency adds shows as listed by the agency until the channel owner confirms the work to us.",
      `${INDEPENDENT_DIRECTORY} ${BRAND_NAME} doesn't charge per lead or take a commission, and is not affiliated with YouTube or Google.`,
    ].join(" "),
    services: services.map((s) => ({
      title: `${s.name} agencies`,
      url: absoluteUrl(`/${s.slug}`),
      note: oneLine(s.intro) || `Compare agencies that offer ${s.name}.`,
    })),
    industries: industryLinks,
    locations: countryLinks,
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
