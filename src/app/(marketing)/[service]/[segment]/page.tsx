import Link from "next/link";
import { notFound } from "next/navigation";

import { DirectoryPage } from "@/components/directory/directory-page";
import { getAgenciesForCombo, getIndexableCombos } from "@/lib/data/agencies";
import { getLiveGuides } from "@/lib/data/guides";
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
  const [agencies, content] = await Promise.all([
    getAgenciesForCombo(service.id, segment),
    segment.kind === "industry" ? getComboContent(service.id, segment.industry.id) : null,
  ]);
  return { service, segment, segmentSlug, agencies, content };
}

export async function generateMetadata({ params }: PageProps<"/[service]/[segment]">) {
  const { service, segment, segmentSlug, agencies } = await load(params);
  return buildMetadata({
    image: `/og/service/${service.slug}/${segmentSlug}`,
    title: directoryTitle(BRAND_NAME, service, segment),
    description: directoryDescription(service, agencies.length, segment),
    path: `/${service.slug}/${segmentSlug}`,
    // docs/SEO.md thin-page rule: noindex,follow until the combo has enough published agencies.
    noindex: agencies.length < MIN_AGENCIES_TO_INDEX,
  });
}

export default async function ComboPage({ params }: PageProps<"/[service]/[segment]">) {
  const { service, segment, segmentSlug, agencies, content } = await load(params);
  const [combos, services, industries, locations, guides] = await Promise.all([
    getIndexableCombos(),
    getServices(),
    getIndustries(),
    getLocations(),
    getLiveGuides(),
  ]);

  const serviceName = new Map(services.map((s) => [s.slug, s.name]));
  const segmentLabel = new Map<string, string>([
    ...industries.map((i) => [`for-${i.slug}`, i.name] as const),
    ...locations.map((l) => [`in-${l.slug}`, l.name] as const),
  ]);
  const prefix = segment.kind === "industry" ? "for-" : "in-";

  // Related links only point at indexable pages, so crawl budget isn't spent on noindex ones.
  const sameService = combos
    .filter(
      (c) =>
        c.serviceSlug === service.slug && c.segment !== segmentSlug && c.segment.startsWith(prefix),
    )
    .map((c) => ({
      href: `/${c.serviceSlug}/${c.segment}`,
      label: segmentLabel.get(c.segment) ?? c.segment,
    }));
  const sameSegment = combos
    .filter((c) => c.segment === segmentSlug && c.serviceSlug !== service.slug)
    .map((c) => ({
      href: `/${c.serviceSlug}/${c.segment}`,
      label: `${serviceName.get(c.serviceSlug) ?? c.serviceSlug} agencies`,
    }));

  const fallbackIntro =
    segment.kind === "industry"
      ? segment.industry.intro
      : `These ${service.name} agencies are based ${segmentPhrase(segment)} or work with businesses there. Compare minimum budgets, team sizes, languages and reviews, then contact the ones that fit.`;
  const intro = content?.intro ?? fallbackIntro;
  const howToChoose = (content?.howToChoose ?? "").split(/\n\s*\n/).filter(Boolean);

  // Live guides that list this page among their related directory pages.
  const guide = guides.find((g) =>
    g.combos.some(
      (c) =>
        c.service_id === service.id &&
        (segment.kind === "industry"
          ? c.industry_id === segment.industry.id
          : c.location_id === segment.location.id),
    ),
  );

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
        {
          title:
            segment.kind === "industry"
              ? `${service.name} for other industries`
              : `${service.name} agencies in other locations`,
          links: sameService,
        },
        { title: `Other services ${segmentPhrase(segment)}`, links: sameSegment },
        {
          title: "Related guide",
          links: guide ? [{ href: `/guides/${guide.slug}`, label: guide.title }] : [],
        },
      ]}
    />
  );
}
