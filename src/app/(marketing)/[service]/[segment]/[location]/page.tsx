import { notFound } from "next/navigation";

import { DirectoryPage } from "@/components/directory/directory-page";
import { getDirectoryIndex } from "@/lib/data/agencies";
import { agenciesForPlace, getPageContent, getPlace } from "@/lib/data/places";
import { getIndustryBySlug, getServiceBySlug } from "@/lib/data/taxonomy";
import {
  faqsFor,
  hubHowToChoose,
  monthYear,
  oneLineSummary,
  relatedGroup,
  shortParagraphs,
} from "@/lib/directory";
import { dataIntro, factRows, hubDescription, hubTitle, pageFacts } from "@/lib/locations";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, MIN_AGENCIES_TO_INDEX } from "@/lib/site";

// /<service>/for-<industry>/in-<country>: service × industry × country. Unlike the other
// directory pages, it only exists with 3+ agencies (404 below), so the combinations never pile up
// as thin pages. Countries only (cities would be too thin).
export const revalidate = 3600;

export async function generateStaticParams() {
  const { paths } = await getDirectoryIndex();
  return [...paths]
    .filter(([p, v]) => p.split("/").length === 4 && v.count >= MIN_AGENCIES_TO_INDEX)
    .map(([p]) => {
      const [, service, segment, location] = p.split("/");
      return { service, segment, location };
    });
}

async function load(params: PageProps<"/[service]/[segment]/[location]">["params"]) {
  const { service: s, segment, location } = await params;
  if (!s.endsWith("-agencies") || !segment.startsWith("for-") || !location.startsWith("in-"))
    notFound();
  const [service, industry, place] = await Promise.all([
    getServiceBySlug(s),
    getIndustryBySlug(segment.slice(4)),
    getPlace(location.slice(3)),
  ]);
  if (!service || !industry || !place) notFound();
  const path = `/${service.slug}/for-${industry.slug}/in-${place.country.slug}`;
  const [{ based, remote }, content] = await Promise.all([
    agenciesForPlace(place, { service: service.slug, industry: industry.slug }),
    getPageContent(path),
  ]);
  if (based.length + remote.length < MIN_AGENCIES_TO_INDEX) notFound();
  const facts = pageFacts([...based, ...remote]);
  return { service, industry, place, path, based, remote, content, facts };
}

export async function generateMetadata({ params }: PageProps<"/[service]/[segment]/[location]">) {
  const { service, industry, place, path, facts } = await load(params);
  return buildMetadata({
    title: hubTitle(
      `${service.name} Agencies for ${industry.name} in ${place.name}`,
      new Date().getFullYear(),
      BRAND_NAME,
    ),
    description: hubDescription(
      `${service.name} agencies for ${industry.name.toLowerCase()} in ${place.name}`,
      facts,
    ),
    path,
  });
}

export default async function ServiceIndustryCountryPage({
  params,
}: PageProps<"/[service]/[segment]/[location]">) {
  const { service, industry, place, path, based, remote, content, facts } = await load(params);
  const what = `${service.name} agencies for ${industry.name.toLowerCase()} in ${place.name}`;
  const intro = content?.intro ?? dataIntro(what, facts, { services: true, industries: true });
  const all = [...based, ...remote];
  const industryPath = `/${service.slug}/for-${industry.slug}`;
  const placePath = `/${service.slug}/in-${place.country.slug}`;
  const { paths } = await getDirectoryIndex();
  const live = (p: string) => (paths.get(p)?.count ?? 0) >= MIN_AGENCIES_TO_INDEX;

  return (
    <DirectoryPage
      heading={`Best ${service.name} Agencies for ${industry.name} in ${place.name}`}
      summary={oneLineSummary(content?.summary, intro)}
      updated={monthYear([content?.updatedAt, ...all.map((a) => a.updatedAt)])}
      highlight={service.slug}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: `${service.name} agencies`, path: `/${service.slug}` },
        { name: industry.name, path: industryPath },
        { name: place.name, path },
      ]}
      agencies={based}
      remote={{ heading: `Agencies that serve ${place.name} remotely`, agencies: remote }}
      glance={factRows(facts)}
      emptyHint={<p>No agencies are based in {place.name} yet; the ones below serve it remotely.</p>}
      matchHref={`/request-proposals?service=${service.slug}&industry=${industry.slug}&ref=directory:${service.slug}`}
      aboutHeading={what}
      about={shortParagraphs(intro)}
      howToChoose={hubHowToChoose(`${industry.name.toLowerCase()} clients in ${place.name}`)}
      faqs={faqsFor(what, all)}
      guides={null}
      related={[
        relatedGroup(
          "Wider pages",
          [
            ...(live(industryPath)
              ? [
                  {
                    href: industryPath,
                    label: `${service.name} for ${industry.name}`,
                    title: `${service.name} agencies for ${industry.name}`,
                    count: paths.get(industryPath)!.count,
                  },
                ]
              : []),
            ...(live(placePath)
              ? [
                  {
                    href: placePath,
                    label: `${service.name} in ${place.name}`,
                    title: `${service.name} agencies in ${place.name}`,
                    count: paths.get(placePath)!.count,
                  },
                ]
              : []),
          ],
        ),
      ]}
    />
  );
}
