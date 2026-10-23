import { SITEMAP_FILES, sitemapEntries } from "@/lib/sitemap";
import { indexXml, newest, SITEMAP_CACHE_CONTROL } from "@/lib/sitemap-core";
import { absoluteUrl } from "@/lib/site";

// The sitemap index (robots.txt points here once ALLOW_INDEXING is "true"): one child per file,
// dated by its newest URL. Revalidated on demand with the children (revalidateSitemap in
// lib/revalidate.ts), hourly as a fallback.
export const revalidate = 3600;

export async function GET() {
  const children = await Promise.all(
    SITEMAP_FILES.map(async (f) => ({
      url: absoluteUrl(`/sitemaps/${f}.xml`),
      lastModified: newest(await sitemapEntries(f)),
    })),
  );
  return new Response(indexXml(children), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_CONTROL,
    },
  });
}
