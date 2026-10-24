import { SITEMAP_FILES, sitemapEntries } from "@/lib/sitemap";
import {
  SITEMAP_CACHE_CONTROL,
  SITEMAP_MAX_URLS,
  sitemapParts,
  urlsetXml,
} from "@/lib/sitemap-core";
import { absoluteUrl } from "@/lib/site";

// Child sitemaps of /sitemap.xml: /sitemaps/<file>.xml per page type (lib/sitemap.ts), and
// <file>-2.xml… once a type passes 50,000 URLs. Indexable pages only, with lastmod from real data.
// Revalidated on demand by every write that changes them (revalidateSitemap, lib/revalidate.ts),
// hourly as a fallback.

export const revalidate = 3600;

export async function generateStaticParams() {
  const params = await Promise.all(
    SITEMAP_FILES.map(async (f) => {
      const parts = sitemapParts((await sitemapEntries(f)).length);
      return Array.from({ length: parts }, (_, i) => ({ file: `${f}${i ? `-${i + 1}` : ""}.xml` }));
    }),
  );
  return params.flat();
}

/** "combos-2.xml" → { file: "combos", part: 2 }; null for anything that isn't ours. */
function parse(name: string) {
  const base = name.replace(/\.xml$/, "");
  for (const file of SITEMAP_FILES) {
    if (base === file) return { file, part: 1 };
    const m = base.match(new RegExp(`^${file}-(\d{1,4})$`));
    if (m && Number(m[1]) >= 2) return { file, part: Number(m[1]) };
  }
  return null;
}

export async function GET(_request: Request, { params }: RouteContext<"/sitemaps/[file]">) {
  const which = parse((await params).file);
  if (!which) return new Response("Not found", { status: 404 });
  const entries = await sitemapEntries(which.file);
  if (which.part > sitemapParts(entries.length)) return new Response("Not found", { status: 404 });
  const slice = entries.slice((which.part - 1) * SITEMAP_MAX_URLS, which.part * SITEMAP_MAX_URLS);
  return new Response(urlsetXml(slice, absoluteUrl), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_CONTROL,
    },
  });
}
