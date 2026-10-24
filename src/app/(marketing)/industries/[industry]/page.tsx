import Link from "next/link";
import { notFound } from "next/navigation";

import { DirectoryPage } from "@/components/directory/directory-page";
import { getDirectoryIndex } from "@/lib/data/agencies";
import { getPageContent, agenciesFor } from "@/lib/data/places";
import { getIndustries, getIndustryBySlug, getLocations, getServices } from "@/lib/data/taxonomy";
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
import { liveLinks } from "@/lib/sitemap-core";

// /industries/<industry>: every agency working in an industry, any service. Indexed (and in the
// sitemap) from 3 published agencies, like every directory page (docs/SEO.md).
export const revalidate = 3600;

export async function generateStaticParams() {
  const { paths } = await getDirectoryIndex();
  return [...paths]
    .filter(([p, v]) => p.startsWith("/industries/") && v.count >= MIN_AGENCIES_TO_INDEX)
    .map(([p]) => ({ industry: p.slice("/industries/".length) }));
}

async function load(params: PageProps<"/industries/[industry]">["params"]) {
  const slug = (await params).industry;
  const industry = await getIndustryBySlug(slug);
  if (!industry) notFound();
  const path = `/industries/${industry.slug}`;
  const [agencies, content] = await Promise.all([
    agenciesFor({ industry: industry.slug }),
    getPageContent(path),
  ]);
  const facts = pageFacts(agencies);
  return { industry, path, agencies, content, facts };
}

const what = (name: string) => `YouTube agencies for ${name.toLowerCase()}`;

export async function generateMetadata({ params }: PageProps<"/industries/[industry]">) {
  const { industry, path, facts } = await load(params);
  return buildMetadata({
    title: hubTitle(`YouTube Agencies for ${industry.name}`, new Date().getFullYear(), BRAND_NAME),
    description: hubDescription(what(industry.name), facts),
    path,
    noindex: facts.count < MIN_AGENCIES_TO_INDEX,
  });
}

export default async function IndustryHubPage({ params }: PageProps<"/industries/[industry]">) {
  const { industry, path, agencies, content, facts } = await load(params);
  const [{ paths }, services, industries, locations] = await Promise.all([
    getDirectoryIndex(),
    getServices(),
    getIndustries(),
    getLocations(),
  ]);
  const serviceName = new Map(services.map((s) => [s.slug, s.name]));
  const industryName = new Map(industries.map((i) => [i.slug, i.name]));
  const placeName = new Map(locations.map((l) => [l.slug, l.name]));
  const intro =
    content?.intro ?? industry.intro ?? dataIntro(what(industry.name), facts, { industries: true });

  return (
    <DirectoryPage
      heading={`Best YouTube Agencies for ${industry.name}`}
      summary={oneLineSummary(content?.summary, intro)}
      updated={monthYear([content?.updatedAt, ...agencies.map((a) => a.updatedAt)])}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: `YouTube agencies for ${industry.name}`, path },
      ]}
      agencies={agencies}
      glance={factRows(facts)}
      emptyHint={
        <p>
          No agencies for {industry.name.toLowerCase()} are listed yet.{" "}
          <Link href="/agencies" className="text-accent hover:underline">
            Browse all agencies
          </Link>
          .
        </p>
      }
      matchHref={`/request-proposals?industry=${industry.slug}&ref=directory:industry`}
      aboutHeading={`YouTube agencies for ${industry.name}`}
      about={shortParagraphs(intro)}
      howToChoose={hubHowToChoose(`${industry.name.toLowerCase()} clients`)}
      faqs={faqsFor(what(industry.name), agencies)}
      guides={null}
      related={[
        relatedGroup(
          `Services for ${industry.name}`,
          liveLinks(paths, MIN_AGENCIES_TO_INDEX, (p) => {
            const m = p.match(/^\/([a-z0-9-]+)\/for-([a-z0-9-]+)$/);
            if (!m || m[2] !== industry.slug) return null;
            const s = serviceName.get(m[1]) ?? m[1];
            return { label: s, title: `${s} agencies for ${industry.name}` };
          }),
          { href: `/agencies?industry=${industry.slug}`, label: "View all" },
        ),
        relatedGroup(
          `${industry.name} by location`,
          liveLinks(paths, MIN_AGENCIES_TO_INDEX, (p) => {
            const m = p.match(/^\/([a-z0-9-]+)\/for-([a-z0-9-]+)\/in-([a-z0-9-]+)$/);
            if (!m || m[2] !== industry.slug) return null;
            const s = serviceName.get(m[1]) ?? m[1];
            const c = placeName.get(m[3]) ?? m[3];
            return { label: `${s} in ${c}`, title: `${s} agencies for ${industry.name} in ${c}` };
          }),
        ),
        relatedGroup(
          "Other industries",
          liveLinks(paths, MIN_AGENCIES_TO_INDEX, (p) => {
            const m = p.match(/^\/industries\/([a-z0-9-]+)$/);
            if (!m || m[1] === industry.slug) return null;
            const i = industryName.get(m[1]) ?? m[1];
            return { label: i, title: `YouTube agencies for ${i}` };
          }),
        ),
      ]}
    />
  );
}
