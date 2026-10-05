import { getAgencyBySlug } from "@/lib/data/agencies";
import { ogImage } from "@/lib/seo/og";

// Social image for /agency/[slug]. Unpublished agencies 404 here too.
export const revalidate = 3600;

export async function GET(_request: Request, { params }: RouteContext<"/og/agency/[slug]">) {
  const agency = await getAgencyBySlug((await params).slug);
  if (!agency) return new Response("Not found", { status: 404 });
  const facts = [agency.services[0]?.name, agency.hq?.name].filter(Boolean).join(" · ");
  return ogImage({
    title: agency.name,
    subtitle: agency.tagline ?? (facts || undefined),
    badge: agency.isVerified ? "Verified" : undefined, // no ✓: the default OG font has no glyph for it
  });
}
