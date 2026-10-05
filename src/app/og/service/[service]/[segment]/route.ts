import { getAgenciesForCombo } from "@/lib/data/agencies";
import { getServiceBySlug, resolveSegment } from "@/lib/data/taxonomy";
import { directoryHeading } from "@/lib/directory";
import { ogImage } from "@/lib/seo/og";

// Social image for /[service]/[segment].
export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: RouteContext<"/og/service/[service]/[segment]">,
) {
  const p = await params;
  const [service, segment] = await Promise.all([
    getServiceBySlug(p.service),
    resolveSegment(p.segment),
  ]);
  if (!service || !segment) return new Response("Not found", { status: 404 });
  const count = (await getAgenciesForCombo(service.id, segment)).length;
  return ogImage({
    title: directoryHeading(service, segment),
    subtitle: count
      ? `Compare ${count} ${count === 1 ? "agency" : "agencies"} by budget, specialty and reviews`
      : undefined,
  });
}
