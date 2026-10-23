import Link from "next/link";
import { notFound } from "next/navigation";

import { DirectoryPage } from "@/components/directory/directory-page";
import { getAgenciesForService, getDirectoryIndex } from "@/lib/data/agencies";
import { getIndustries, getLocations, getServiceBySlug, getServices } from "@/lib/data/taxonomy";
import {
  defaultFaqs,
  defaultHowToChoose,
  directoryDescription,
  directoryHeading,
  directoryTitle,
  monthYear,
  oneLineSummary,
  relatedGroup,
  shortParagraphs,
} from "@/lib/directory";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, MIN_AGENCIES_TO_INDEX } from "@/lib/site";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getServices()).map((s) => ({ service: s.slug }));
}

async function load(slug: string) {
  // Service slugs always end in -agencies (CLAUDE.md); skip the lookup for anything else.
  const service = slug.endsWith("-agencies") ? await getServiceBySlug(slug) : null;
  if (!service) notFound();
  return { service, agencies: await getAgenciesForService(service.id) };
}

export async function generateMetadata({ params }: PageProps<"/[service]">) {
  const { service, agencies } = await load((await params).service);
  return buildMetadata({
    image: `/og/service/${service.slug}`,
    title: directoryTitle(BRAND_NAME, service),
    description: directoryDescription(service, agencies.length),
    path: `/${service.slug}`,
    // docs/SEO.md thin-page rule: a new service stays noindex,follow until it has enough agencies.
    noindex: agencies.length < MIN_AGENCIES_TO_INDEX,
  });
}

export default async function ServiceHubPage({ params }: PageProps<"/[service]">) {
  const { service, agencies } = await load((await params).service);
  const [{ combos, hubCounts }, industries, locations, services] = await Promise.all([
    getDirectoryIndex(),
    getIndustries(),
    getLocations(),
    getServices(),
  ]);

  // "Explore more": indexable pages only (the sitemap's index and 3-agency rule), most agencies
  // first. docs/SEO.md: the hub links to its indexed industry and location pages.
  const mine = combos.filter((c) => c.serviceSlug === service.slug);
  const industryName = new Map(industries.map((i) => [`for-${i.slug}`, i.name]));
  const locationName = new Map(locations.map((l) => [`in-${l.slug}`, l.name]));
  const linksFor = (names: Map<string, string>, phrase: (name: string) => string) =>
    mine.flatMap((c) => {
      const label = names.get(c.segment);
      return label
        ? [
            {
              href: `/${service.slug}/${c.segment}`,
              label,
              title: `${service.name} agencies ${phrase(label)}`,
              count: c.count,
            },
          ]
        : [];
    });
  const browseService = { href: `/agencies?service=${service.slug}`, label: "View all" };

  const intro =
    service.intro ??
    `Compare agencies that offer ${service.name}. Each card shows minimum budget, specialties and location, so you can shortlist quickly. Filter by budget, team size and language, or pick your industry below.`;

  return (
    <DirectoryPage
      heading={directoryHeading(service)}
      summary={oneLineSummary(null, intro)}
      updated={monthYear(agencies.map((a) => a.updatedAt))}
      highlight={service.slug}
      matchHref={`/request-proposals?service=${service.slug}&ref=directory:${service.slug}`}
      aboutHeading={`About ${service.name} agencies`}
      about={shortParagraphs(intro)}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: `${service.name} agencies`, path: `/${service.slug}` },
      ]}
      agencies={agencies}
      emptyHint={
        <p>
          No {service.name} agencies are listed yet.{" "}
          <Link href="/request-proposals" className="text-accent hover:underline">
            Tell us what you need
          </Link>{" "}
          and we&apos;ll match you with agencies that fit.
        </p>
      }
      howToChoose={defaultHowToChoose(service)}
      faqs={defaultFaqs(service, agencies)}
      related={[
        relatedGroup(
          `${service.name} by industry`,
          linksFor(industryName, (n) => `for ${n}`),
          browseService,
        ),
        relatedGroup(
          `${service.name} by location`,
          linksFor(locationName, (n) => `in ${n}`),
          browseService,
        ),
        relatedGroup(
          "Other services",
          services
            .filter(
              (s) =>
                s.slug !== service.slug && (hubCounts.get(s.slug) ?? 0) >= MIN_AGENCIES_TO_INDEX,
            )
            .map((s) => ({
              href: `/${s.slug}`,
              label: s.name,
              title: `${s.name} agencies`,
              count: hubCounts.get(s.slug) ?? 0,
            })),
          { href: "/agencies", label: "View all agencies" },
        ),
      ]}
    />
  );
}
