import { getAgencySlugs, getDirectoryIndex } from "@/lib/data/agencies";
import { getLiveAuthors, getLiveGuides } from "@/lib/data/guides";
import { getServices } from "@/lib/data/taxonomy";
import { absoluteUrl } from "@/lib/site";

// Segmented sitemaps at the paths in docs/SEO.md: /sitemaps/{agencies,categories,guides}.xml.
// Only indexable pages, with lastmod from real data (omitted where we don't have a real date).

export const revalidate = 3600;
export const dynamicParams = false;

const FILES = ["agencies.xml", "categories.xml", "guides.xml"] as const;
type Entry = { path: string; lastModified?: string | null };

export function generateStaticParams() {
  return FILES.map((file) => ({ file }));
}

async function entries(file: (typeof FILES)[number]): Promise<Entry[]> {
  if (file === "agencies.xml") {
    return (await getAgencySlugs()).map((a) => ({
      path: `/agency/${a.slug}`,
      lastModified: a.updatedAt,
    }));
  }
  if (file === "categories.xml") {
    const [{ combos, hubs, siteLastModified }, services] = await Promise.all([
      getDirectoryIndex(),
      getServices(),
    ]);
    return [
      { path: "/", lastModified: siteLastModified },
      { path: "/get-matched" },
      { path: "/list-your-agency" },
      { path: "/for-agencies/pricing" },
      { path: "/how-we-rank" },
      { path: "/about" },
      { path: "/contact" },
      { path: "/editorial-policy" },
      { path: "/disclosure" },
      { path: "/privacy" },
      { path: "/refunds" },
      { path: "/cookies" },
      { path: "/terms" },
      ...services.map((s) => ({ path: `/${s.slug}`, lastModified: hubs.get(s.slug) })),
      ...combos.map((c) => ({
        path: `/${c.serviceSlug}/${c.segment}`,
        lastModified: c.lastModified,
      })),
    ];
  }
  const guides = (await getLiveGuides()).map((g) => ({ slug: g.slug, updated: g.updatedAt }));
  const newest = guides
    .map((g) => g.updated)
    .sort()
    .at(-1);
  // Author pages ride along in the guides sitemap (they only exist for authors with live guides).
  const authors = await getLiveAuthors();
  return [
    { path: "/guides", lastModified: newest },
    ...guides.map((g) => ({ path: `/guides/${g.slug}`, lastModified: g.updated })),
    ...authors.map((a) => ({ path: `/authors/${a.slug}`, lastModified: a.updated_at })),
  ];
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET(_request: Request, { params }: RouteContext<"/sitemaps/[file]">) {
  const { file } = await params;
  if (!(FILES as readonly string[]).includes(file))
    return new Response("Not found", { status: 404 });
  const urls = (await entries(file as (typeof FILES)[number]))
    .map(({ path, lastModified }) => {
      const loc = `<loc>${escapeXml(absoluteUrl(path))}</loc>`;
      const lastmod = lastModified
        ? `<lastmod>${new Date(lastModified).toISOString()}</lastmod>`
        : "";
      return `  <url>${loc}${lastmod}</url>`;
    })
    .join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
