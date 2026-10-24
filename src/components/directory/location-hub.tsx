import { notFound } from "next/navigation";

import { DirectoryPage } from "@/components/directory/directory-page";
import { getDirectoryIndex } from "@/lib/data/agencies";
import { agenciesForPlace, getPageContent, getPlace, type Place } from "@/lib/data/places";
import { getLocations, getServices } from "@/lib/data/taxonomy";
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

// /locations/<country> and /locations/<country>/<city>: agencies based there, then (apart, under
// their own heading) agencies based elsewhere that name the place. A place with no agencies at all
// has no page (404): empty city and country pages never exist. Indexed from 3 agencies.

const pathOf = (p: Place) =>
  p.city ? `/locations/${p.country.slug}/${p.city.slug}` : `/locations/${p.country.slug}`;

export async function loadLocationHub(country: string, city?: string) {
  const place = await getPlace(country, city);
  if (!place) notFound();
  const path = pathOf(place);
  const [{ based, remote }, content] = await Promise.all([
    agenciesForPlace(place),
    getPageContent(path),
  ]);
  if (based.length + remote.length === 0) notFound();
  const facts = pageFacts([...based, ...remote]);
  return { place, path, based, remote, content, facts };
}

const what = (place: Place) => `YouTube agencies in ${place.name}`;

export async function locationHubMetadata(country: string, city?: string) {
  const { place, path, facts } = await loadLocationHub(country, city);
  return buildMetadata({
    title: hubTitle(`YouTube Agencies in ${place.name}`, new Date().getFullYear(), BRAND_NAME),
    description: hubDescription(what(place), facts),
    path,
    noindex: facts.count < MIN_AGENCIES_TO_INDEX,
  });
}

export async function LocationHub({ country, city }: { country: string; city?: string }) {
  const { place, path, based, remote, content, facts } = await loadLocationHub(country, city);
  const [{ paths }, services, locations] = await Promise.all([
    getDirectoryIndex(),
    getServices(),
    getLocations(),
  ]);
  const serviceName = new Map(services.map((s) => [s.slug, s.name]));
  const placeName = new Map(locations.map((l) => [l.slug, l.name]));
  const here = place.city ?? place.country;
  const intro = content?.intro ?? dataIntro(what(place), facts);

  return (
    <DirectoryPage
      heading={`Best YouTube Agencies in ${place.name}`}
      summary={oneLineSummary(content?.summary, intro)}
      updated={monthYear([content?.updatedAt, ...[...based, ...remote].map((a) => a.updatedAt)])}
      breadcrumbs={[
        { name: "Home", path: "/" },
        {
          name: `YouTube agencies in ${place.country.name}`,
          path: `/locations/${place.country.slug}`,
        },
        ...(place.city ? [{ name: place.city.name, path }] : []),
      ]}
      agencies={based}
      remote={{ heading: `Agencies that serve ${place.name} remotely`, agencies: remote }}
      glance={factRows(facts)}
      emptyHint={
        <p>
          No agencies are based in {place.name} yet; the ones below work with clients here remotely.
        </p>
      }
      matchHref={`/request-proposals?ref=directory:${here.slug}`}
      aboutHeading={`YouTube agencies in ${place.name}`}
      about={shortParagraphs(intro)}
      howToChoose={hubHowToChoose(`businesses in ${place.name}`)}
      faqs={faqsFor(what(place), [...based, ...remote])}
      guides={null}
      related={[
        relatedGroup(
          `Services in ${place.name}`,
          liveLinks(paths, MIN_AGENCIES_TO_INDEX, (p) => {
            const m = p.match(/^\/([a-z0-9-]+)\/in-([a-z0-9-]+)$/);
            if (!m || m[2] !== here.slug) return null;
            const s = serviceName.get(m[1]) ?? m[1];
            return { label: s, title: `${s} agencies in ${place.name}` };
          }),
          { href: `/agencies?country=${place.country.slug}`, label: "View all" },
        ),
        relatedGroup(
          place.city ? `More in ${place.country.name}` : `Cities in ${place.country.name}`,
          liveLinks(paths, MIN_AGENCIES_TO_INDEX, (p) => {
            if (place.city && p === `/locations/${place.country.slug}`)
              return {
                label: place.country.name,
                title: `YouTube agencies in ${place.country.name}`,
              };
            const m = p.match(/^\/locations\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
            if (!m || m[1] !== place.country.slug || m[2] === place.city?.slug) return null;
            const c = placeName.get(m[2]) ?? m[2];
            return { label: c, title: `YouTube agencies in ${c}` };
          }),
        ),
        relatedGroup(
          "Other countries",
          liveLinks(paths, MIN_AGENCIES_TO_INDEX, (p) => {
            const m = p.match(/^\/locations\/([a-z0-9-]+)$/);
            if (!m || m[1] === place.country.slug) return null;
            const c = placeName.get(m[1]) ?? m[1];
            return { label: c, title: `YouTube agencies in ${c}` };
          }),
        ),
      ]}
    />
  );
}

/** Location hubs worth pre-rendering: the live ones (others render on first request). */
export async function liveLocationParams() {
  const { paths } = await getDirectoryIndex();
  return [...paths]
    .filter(([p, v]) => p.startsWith("/locations/") && v.count >= MIN_AGENCIES_TO_INDEX)
    .map(([p]) => p.split("/").slice(2));
}
