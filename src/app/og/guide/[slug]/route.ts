import { getGuideBySlug, getLiveGuides } from "@/lib/data/guides";
import { ogImage } from "@/lib/seo/og";

// Social image for /guides/[slug]: the guide's cover when it has one, else a generated card.
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getLiveGuides()).map((g) => ({ slug: g.slug }));
}

export async function GET(_request: Request, { params }: RouteContext<"/og/guide/[slug]">) {
  const guide = await getGuideBySlug((await params).slug);
  if (!guide) return new Response("Not found", { status: 404 });
  if (guide.coverPath) {
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/agency-media/${guide.coverPath}`,
      307,
    );
  }
  return ogImage({ title: guide.title, subtitle: "Guide" });
}
