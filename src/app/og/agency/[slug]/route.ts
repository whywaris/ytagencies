import { logoUrl } from "@/components/agency-logo";
import { getAgencyBySlug } from "@/lib/data/agencies";
import { agencyOgImage } from "@/lib/seo/og";

// Social image for /agency/[slug] (1200×630). Unpublished agencies 404 here too.
export const revalidate = 3600;

const UNIT: Record<string, string> = {
  retainer: "/month",
  performance: "/month",
  per_video: "/video",
  project: "/project",
};

export async function GET(_request: Request, { params }: RouteContext<"/og/agency/[slug]">) {
  const agency = await getAgencyBySlug((await params).slug);
  if (!agency) return new Response("Not found", { status: 404 });
  const city = agency.hqCity ?? agency.hqCountry;
  return agencyOgImage({
    name: agency.name,
    // The renderer draws PNG and JPEG only; other logos fall back to initials.
    logo:
      agency.logoPath && /\.(png|jpe?g)$/i.test(agency.logoPath) ? logoUrl(agency.logoPath) : null,
    verified: agency.isVerified,
    line: [agency.services[0]?.name, city].filter(Boolean).join(" · ") || null,
    price:
      agency.minBudgetUsd !== null
        ? `From $${agency.minBudgetUsd.toLocaleString("en-US")}${UNIT[agency.pricingModel ?? ""] ?? ""}`
        : null,
  });
}
