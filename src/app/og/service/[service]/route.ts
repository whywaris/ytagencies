import { getAgenciesForService } from "@/lib/data/agencies";
import { getServiceBySlug } from "@/lib/data/taxonomy";
import { directoryHeading } from "@/lib/directory";
import { ogImage } from "@/lib/seo/og";

// Social image for /[service]. Fixed path so buildMetadata can reference it.
export const revalidate = 3600;

export async function GET(_request: Request, { params }: RouteContext<"/og/service/[service]">) {
  const service = await getServiceBySlug((await params).service);
  if (!service) return new Response("Not found", { status: 404 });
  const count = (await getAgenciesForService(service.id)).length;
  return ogImage({
    title: directoryHeading(service),
    subtitle: count
      ? `Compare ${count} ${count === 1 ? "agency" : "agencies"} by budget, specialty and reviews`
      : "Compare agencies by budget and specialty",
  });
}
