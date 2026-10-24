import Link from "next/link";
import { notFound } from "next/navigation";

import { DirectoryPage } from "@/components/directory/directory-page";
import { getAgenciesForCombo, getIndexableCombos } from "@/lib/data/agencies";
import { guidesForPage } from "@/lib/data/guides";
import { agenciesForPlace, getPageContent, getPlaceBySlug } from "@/lib/data/places";
import { dataIntro, pageFacts } from "@/lib/locations";
import {
  getComboContent,
  getIndustries,
  getLocations,
  getServiceBySlug,
  getServices,
  resolveSegment,
} from "@/lib/data/taxonomy";
import {
  defaultFaqs,
  defaultHowToChoose,
  directoryDescription,
  directoryHeading,
  directoryTitle,
  monthYear,
  oneLineSummary,
  segmentName,
  segmentPhrase,
  shortParagraphs,
  guideGroup,
  relatedGroup,
} from "@/lib/directory";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, MIN_AGENCIES_TO_INDEX } from "@/lib/site";

export const revalidate = 3600;

// Pre-render indexable combos; thin ones render on first request and are then cached the same way.
export async function generateStaticParams() {
  return (await getIndexableCombos()).map((c) => ({ service: c.serviceSlug, segment: c.segment }));
}

async function load(params: PageProps<"/[service]/[segment]">["params"]) {
  const { service: serviceSlug, segment: segmentSlug } = await params;
  const [service, segment] = await Promise.all([
    serviceSlug.endsWith("-agencies") ? getServiceBySlug(serviceSlug) : null,
    resolveSegment(segmentSlug), // null for anything but for-<industry> / in-<location>
  ]);
  if (!service || !segment) notFound();
  if (segment.kind === "location") {
    // Based there first; agencies based elsewhere that name the place are listed apart. A place
    // with none at all has no page (never an empty city page).
    const place = await getPlaceBySlug(segment.slug);
    if (!place) notFound();
    const path = `/${service.slug}/${segmentSlug}`;
    const [{ based, remote }, page] = await Promise.all([
      agenciesForPlace(place, { service: service.slug }),
      getPageContent(path),
    ]);
    if (based.length + remote.length === 0) notFound();
    const content = page && {
      summary: page.summary,
      intro: page.intro,
      howToChoose: null,
      faqs: [],
      updatedAt: page.updatedAt,
    };
    return { service, segment, segmentSlug, agencies: based, remote, content };
  }
  const [agencies, content] = await Promise.all([
    getAgenciesForCombo(service.id, segment),
    getComboContent(service.id, segment.industry.id),
  ]);
  return { service, segment, segmentSlug, agencies, remote: [], content };
}

export async function generateMetadata({ params }: PageProps<"/[service]/[segment]">) {
  const { service, segment, segmentSlug, agencies, remote } = await load(params);
  return buildMetadata({
    image: `/og/service/${service.slug}/${segmentSlug}`,
    title: directoryTitle(BRAND_NAME, service, segment),
    description: directoryDescription(service, agencies.length + remote.length, segment),
    path: `/${service.slug}/${segmentSlug}`,
    // docs/SEO.md thin-page rule: noindex,follow until the combo has enough published agencies.
    noindex: agencies.length + remote.length < MIN_AGENCIES_TO_INDEX,
  });
}

export default async function ComboPage({ params }: PageProps<"/[service]/[segment]">) {
  const { service, segment, segmentSlug, agencies, remote, content } = await load(params);
  const [combos, services, industries, locations, guides] = await Promise.all([
    getIndexableCombos(),
    getServices(),
    getIndustries(),
    getLocations(),
    guidesForPage({
      serviceId: service.id,
      ...(segment.kind === "industry"
        ? { industryId: segment.industry.id }
        : { locationId: segment.location.id }),
    }),
  ]);

  const serviceName = new Map(services.map((s) => [s.slug, s.name]));
  const segmentLabel = new Map<string, string>([
    ...industries.map((i) => [`for-${i.slug}`, i.name] as const),
    ...locations.map((l) => [`in-${l.slug}`, l.name] as const),
  ]);
  const prefix = segment.kind === "industry" ? "for-" : "in-";

  // "Explore more" only points at indexable pages (the sitemap's index and 3-agency rule), so
  // crawl budget isn't spent on noindex or empty ones. Most agencies first.
  const phrase = (label: string) => (segment.kind === "industry" ? `for ${label}` : `in ${label}`);
  const sameService = combos
    .filter(
      (c) =>
        c.serviceSlug === service.slug && c.segment !== segmentSlug && c.segment.startsWith(prefix),
    )
    .map((c) => {
      const label = segmentLabel.get(c.segment) ?? c.segment;
      return {
        href: `/${c.serviceSlug}/${c.segment}`,
        label,
        title: `${service.name} agencies ${phrase(label)}`,
        count: c.count,
      };
    });
  const sameSegment = combos
    .filter((c) => c.segment === segmentSlug && c.serviceSlug !== service.slug)
    .map((c) => {
      const label = serviceName.get(c.serviceSlug) ?? c.serviceSlug;
      return {
        href: `/${c.serviceSlug}/${c.segment}`,
        label,
        title: `${label} agencies ${segmentPhrase(segment)}`,
        count: c.count,
      };
    });
  const place = segmentName(segment);
  const browseSegment =
    segment.kind === "industry"
      ? { href: `/agencies?industry=${segment.industry.slug}`, label: "View all" }
      : segment.location.type === "country"
        ? { href: `/agencies?country=${segment.location.slug}`, label: "View all" }
        : undefined;

  const fallbackIntro =
    segment.kind === "industry"
      ? segment.industry.intro
      : // Until an admin writes one: only what the listed agencies' data says.
        dataIntro(
          `${service.name} ${segmentPhrase(segment)}`,
          pageFacts([...agencies, ...remote]),
          {
            services: true,
          },
        );
  const intro = content?.intro ?? fallbackIntro;
  const howToChoose = (content?.howToChoose ?? "").split(/\n\s*\n/).filter(Boolean);

  const match = new URLSearchParams({ service: service.slug });
  if (segment.kind === "industry") match.set("industry", segment.industry.slug);
  match.set("ref", `directory:${service.slug}`);

  return (
    <DirectoryPage
      heading={directoryHeading(service, segment)}
      summary={oneLineSummary(content?.summary, intro)}
      updated={monthYear([content?.updatedAt, ...agencies.map((a) => a.updatedAt)])}
      highlight={service.slug}
      matchHref={`/request-proposals?${match}`}
      aboutHeading={
        segment.kind === "industry"
          ? `${service.name} for ${segment.industry.name} brands`
          : `${service.name} agencies ${segmentPhrase(segment)}`
      }
      about={shortParagraphs(intro)}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: `${service.name} agencies`, path: `/${service.slug}` },
        { name: segmentName(segment), path: `/${service.slug}/${segmentSlug}` },
      ]}
      agencies={agencies}
      remote={
        segment.kind === "location"
          ? {
              heading: `${service.name} agencies that serve ${segment.location.name} remotely`,
              agencies: remote,
            }
          : undefined
      }
      emptyHint={
        <p>
          No {service.name} agencies {segmentPhrase(segment)} are listed yet. See{" "}
          <Link href={`/${service.slug}`} className="text-accent hover:underline">
            all {service.name} agencies
          </Link>{" "}
          or{" "}
          <Link href="/request-proposals" className="text-accent hover:underline">
            tell us what you need
          </Link>
          .
        </p>
      }
      howToChoose={howToChoose.length ? howToChoose : defaultHowToChoose(service, segment)}
      faqs={content?.faqs.length ? content.faqs : defaultFaqs(service, agencies, segment)}
      related={[
        relatedGroup(
          segment.kind === "industry"
            ? `${service.name} for other industries`
            : `${service.name} in other locations`,
          sameService,
          { href: `/${service.slug}`, label: `All ${service.name} agencies` },
        ),
        relatedGroup(
          segment.kind === "industry"
            ? `Other services for ${place}`
            : `Other services in ${place}`,
          sameSegment,
          browseSegment,
        ),
      ]}
      guides={guideGroup(guides)}
    />
  );
}
