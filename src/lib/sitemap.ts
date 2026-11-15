import "server-only";

import { getGuideCategories, getLiveAuthors, getLiveGuides } from "@/lib/data/guides";
import { categoryIndexable } from "@/lib/guide-categories";
import { PAGE_UPDATED } from "@/lib/page-dates";
import {
  llmsTxt,
  newest,
  oneLine,
  SITEMAP_FILES,
  type Entry,
  type SitemapFile,
} from "@/lib/sitemap-core";
import { BRAND_NAME, absoluteUrl } from "@/lib/site";

// Data for /sitemap.xml, /sitemaps/<file>.xml and /llms.txt (docs/SEO.md). Indexable pages only.

export { SITEMAP_FILES, type SitemapFile };

const dated = (guides: { updatedAt: string }[]) =>
  newest(guides.map((g) => ({ path: "", lastModified: g.updatedAt })));

export async function sitemapEntries(file: SitemapFile): Promise<Entry[]> {
  switch (file) {
    case "pages": {
      const latest = dated(await getLiveGuides());
      // Pages whose content we date; the rest have no lastmod rather than a made-up one.
      return [
        { path: "/", lastModified: latest },
        { path: "/guides", lastModified: latest },
        { path: "/about" },
        { path: "/contact" },
        ...Object.entries(PAGE_UPDATED).map(([path, lastModified]) => ({ path, lastModified })),
      ];
    }
    case "guides": {
      const [guides, categories] = await Promise.all([getLiveGuides(), getGuideCategories()]);
      // Category pages only once they're indexable (3+ live guides).
      const cats = categories.flatMap((c) => {
        const inIt = guides.filter((g) => g.categoryId === c.id);
        return categoryIndexable(inIt.length)
          ? [{ path: `/guides/category/${c.slug}`, lastModified: dated(inIt) }]
          : [];
      });
      return [
        ...guides.map((g) => ({ path: `/guides/${g.slug}`, lastModified: g.updatedAt })),
        ...cats,
      ];
    }
    case "authors":
      // Author pages only exist for authors with live guides.
      return (await getLiveAuthors()).map((a) => ({
        path: `/authors/${a.slug}`,
        lastModified: a.updated_at,
      }));
  }
}

/** /llms.txt: what the site is, and links to its live guides. */
export async function buildLlmsTxt() {
  const guides = await getLiveGuides();
  return llmsTxt({
    brand: BRAND_NAME,
    summary: "Practical guides on YouTube for businesses and creators.",
    about: `${BRAND_NAME} publishes guides on YouTube ads, SEO, Shorts, channel growth and what it costs to get help. It is independent and not affiliated with YouTube or Google.`,
    guides: guides.map((g) => ({
      title: g.title,
      url: absoluteUrl(`/guides/${g.slug}`),
      note: oneLine(g.description || g.excerpt),
    })),
    pages: [
      { title: "About", url: absoluteUrl("/about") },
      { title: "Editorial policy", url: absoluteUrl("/editorial-policy") },
      { title: "Contact", url: absoluteUrl("/contact") },
      { title: "Privacy policy", url: absoluteUrl("/privacy") },
      { title: "Terms", url: absoluteUrl("/terms") },
    ],
  });
}
