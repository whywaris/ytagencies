import { getGuideBySlug, getLiveGuides, mediaUrl } from "@/lib/data/guides";
import { guideCoverImage, OG_SIZE } from "@/lib/seo/og";

// Social image for /guides/[slug]: the guide's cover when it has one, else the typographic cover.
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getLiveGuides()).map((g) => ({ slug: g.slug }));
}

export async function GET(_request: Request, { params }: RouteContext<"/og/guide/[slug]">) {
  const guide = await getGuideBySlug((await params).slug);
  if (!guide) return new Response("Not found", { status: 404 });
  if (guide.coverPath) return Response.redirect(mediaUrl(guide.coverPath), 307);
  return guideCoverImage(guide.title, OG_SIZE);
}
