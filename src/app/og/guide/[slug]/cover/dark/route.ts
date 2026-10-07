import { getGuideBySlug, getLiveGuides } from "@/lib/data/guides";
import { COVER_SIZE, guideCoverImage } from "@/lib/seo/og";

// Dark-mode version of the 16:9 typographic cover (picked by the browser in dark mode).
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getLiveGuides()).map((g) => ({ slug: g.slug }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/og/guide/[slug]/cover/dark">,
) {
  const guide = await getGuideBySlug((await params).slug);
  if (!guide) return new Response("Not found", { status: 404 });
  return guideCoverImage(guide.title, COVER_SIZE, "dark");
}
