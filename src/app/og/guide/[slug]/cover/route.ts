import { getGuideBySlug, getLiveGuides } from "@/lib/data/guides";
import { COVER_SIZE, guideCoverImage } from "@/lib/seo/og";

// 16:9 typographic cover for guides without an uploaded one (hero and guide cards).
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getLiveGuides()).map((g) => ({ slug: g.slug }));
}

export async function GET(_request: Request, { params }: RouteContext<"/og/guide/[slug]/cover">) {
  const guide = await getGuideBySlug((await params).slug);
  if (!guide) return new Response("Not found", { status: 404 });
  return guideCoverImage(guide.title, COVER_SIZE);
}
