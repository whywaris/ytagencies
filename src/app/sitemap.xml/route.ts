import { SITEMAP_FILES, sitemapEntries } from "@/lib/sitemap";
import {
  indexXml,
  newest,
  SITEMAP_CACHE_CONTROL,
  SITEMAP_MAX_URLS,
  sitemapParts,
} from "@/lib/sitemap-core";
import { absoluteUrl } from "@/lib/site";

// The sitemap index (robots.txt points here once ALLOW_INDEXING is "true"): one child per page
// type, split into numbered parts above 50,000 URLs (<file>.xml, <file>-2.xml…), each dated by its
// newest URL. Revalidated on demand with the children (revalidateSitemap in lib/revalidate.ts),
// hourly as a fallback.
export const revalidate = 3600;

export async function GET() {
  const children = (
    await Promise.all(
      SITEMAP_FILES.map(async (f) => {
        const entries = await sitemapEntries(f);
        return Array.from({ length: sitemapParts(entries.length) }, (_, i) => ({
          url: absoluteUrl(`/sitemaps/${f}${i ? `-${i + 1}` : ""}.xml`),
          lastModified: newest(entries.slice(i * SITEMAP_MAX_URLS, (i + 1) * SITEMAP_MAX_URLS)),
        }));
      }),
    )
  ).flat();
  return new Response(indexXml(children), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_CONTROL,
    },
  });
}
