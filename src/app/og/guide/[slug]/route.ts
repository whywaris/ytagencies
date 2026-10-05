import { GUIDES } from "@/content/guides/registry";
import { ogImage } from "@/lib/seo/og";

// Social image for /guides/[slug].
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }));
}

export async function GET(_request: Request, { params }: RouteContext<"/og/guide/[slug]">) {
  const load = GUIDES[(await params).slug];
  if (!load) return new Response("Not found", { status: 404 });
  const { meta } = await load();
  return ogImage({ title: meta.title, subtitle: "Guide" });
}
