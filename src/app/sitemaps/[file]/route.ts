import { SITEMAP_FILES, sitemapEntries, type SitemapFile } from "@/lib/sitemap";
import { urlsetXml } from "@/lib/sitemap-core";
import { absoluteUrl } from "@/lib/site";

// Child sitemaps of /sitemap.xml: /sitemaps/<pages|services|combos|locations|agencies|guides|
// authors>.xml. Indexable pages only (lib/sitemap.ts), with lastmod from real data. ISR hourly,
// and revalidated on demand when agencies or guides change (lib/revalidate.ts).

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return SITEMAP_FILES.map((f) => ({ file: `${f}.xml` }));
}

export async function GET(_request: Request, { params }: RouteContext<"/sitemaps/[file]">) {
  const name = (await params).file.replace(/\.xml$/, "") as SitemapFile;
  if (!SITEMAP_FILES.includes(name)) return new Response("Not found", { status: 404 });
  return new Response(urlsetXml(await sitemapEntries(name), absoluteUrl), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
