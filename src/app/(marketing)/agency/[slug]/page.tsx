import Link from "next/link";
import { notFound } from "next/navigation";

import { AgencyLogo, logoUrl } from "@/components/agency-logo";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AgencyTracker } from "@/components/agency-tracker";
import { LazyContactForm } from "@/components/forms/lazy-contact-form";
import { JsonLd } from "@/components/json-ld";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAgencyBySlug, getAgencySlugs, getSimilarAgencies } from "@/lib/data/agencies";
import { getLocations } from "@/lib/data/taxonomy";
import { minBudgetLabel } from "@/lib/directory";
import {
  formatMetrics,
  PRICING_LABEL,
  profileDescription,
  profileTitle,
  safeExternalUrl,
} from "@/lib/profile";
import { breadcrumbJsonLd, professionalServiceJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getAgencySlugs()).map(({ slug }) => ({ slug }));
}

async function load(params: PageProps<"/agency/[slug]">["params"]) {
  // Anon client + status filter: drafts, archived and unknown slugs all come back null.
  const agency = await getAgencyBySlug((await params).slug);
  if (!agency) notFound();
  return agency;
}

export async function generateMetadata({ params }: PageProps<"/agency/[slug]">) {
  const agency = await load(params);
  return buildMetadata({
    image: `/og/agency/${agency.slug}`,
    title: profileTitle(agency),
    description: profileDescription(agency),
    path: `/agency/${agency.slug}`,
  });
}

const sectionTitle = "text-h2";
const rowLink =
  "flex min-h-11 flex-col justify-center rounded-lg border border-line px-5 py-4 transition-colors duration-150 ease-out hover:border-text-2";

function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`Rated ${rating} out of 5`} className="text-text">
      {"★".repeat(Math.round(rating))}
      <span className="text-line">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

export default async function AgencyPage({ params }: PageProps<"/agency/[slug]">) {
  const agency = await load(params);
  const [locations, similar] = await Promise.all([getLocations(), getSimilarAgencies(agency, 4)]);

  const primary = agency.services[0];
  const website = safeExternalUrl(agency.website);
  const hqLocation = agency.hq && locations.find((l) => l.slug === agency.hq!.slug);
  const hqCountry = hqLocation?.parentId
    ? (locations.find((l) => l.id === hqLocation.parentId)?.name ?? null)
    : null;
  // Rating from the moderated reviews on this page only.
  const rating =
    agency.reviews.length > 0
      ? {
          average:
            Math.round(
              (agency.reviews.reduce((n, r) => n + r.rating, 0) / agency.reviews.length) * 10,
            ) / 10,
          count: agency.reviews.length,
        }
      : null;

  const breadcrumbs = [
    { name: "Home", path: "/" },
    ...(primary ? [{ name: `${primary.name} agencies`, path: `/${primary.slug}` }] : []),
    { name: agency.name, path: `/agency/${agency.slug}` },
  ];

  const facts = [
    [
      "Minimum budget",
      minBudgetLabel(agency.minBudgetUsd, agency.pricingModel)?.replace(/^From /, ""),
    ],
    ["Pricing", agency.pricingModel && PRICING_LABEL[agency.pricingModel]],
    ["Team size", agency.teamSize && `${agency.teamSize} people`],
    ["Founded", agency.foundedYear?.toString()],
    ["Languages", agency.languages.join(", ")],
    ["Locations", agency.locations.map((l) => l.name).join(", ")],
  ].filter((f): f is [string, string] => Boolean(f[1]));

  return (
    <>
      <AgencyTracker agencyId={agency.id} />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <JsonLd
        data={professionalServiceJsonLd({
          slug: agency.slug,
          name: agency.name,
          description: agency.description,
          website: website?.href ?? null,
          logoUrl: agency.logoPath ? logoUrl(agency.logoPath) : null,
          areaServed: agency.locations.map((l) => l.name),
          hq: agency.hq ? { city: agency.hq.name, country: hqCountry } : null,
          rating,
        })}
      />

      <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-12 md:px-6 md:py-20">
        <Breadcrumbs items={breadcrumbs} />

        <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <AgencyLogo name={agency.name} logoPath={agency.logoPath} size="lg" />
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-h1">{agency.name}</h1>
              {agency.tagline && (
                <p className="text-h3 font-normal text-text-2">{agency.tagline}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {agency.isVerified && <Badge variant="verified">✓ Verified</Badge>}
              {agency.isFeatured && <Badge variant="featured">Featured · Paid</Badge>}
              {rating && (
                <a
                  href="#reviews"
                  className="flex min-h-11 items-center gap-2 text-small hover:text-text"
                >
                  <Stars rating={rating.average} />
                  {rating.average.toFixed(1)} · {rating.count}{" "}
                  {rating.count === 1 ? "review" : "reviews"}
                </a>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Button asChild>
                <a href="#contact" data-track="contact_open">
                  Contact agency
                </a>
              </Button>
              {website && (
                <a
                  href={website.href}
                  target="_blank"
                  data-track="website_click"
                  // SECURITY.md: nofollow for listings, sponsored for paid placements.
                  rel={agency.isFeatured ? "sponsored noopener" : "nofollow noopener"}
                  className="flex min-h-11 items-center text-accent hover:underline"
                >
                  {website.hostname.replace(/^www\./, "")}
                  <span aria-hidden>&nbsp;↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div className="flex max-w-reading min-w-0 flex-col gap-16">
            {agency.description && (
              <section aria-labelledby="about" className="flex flex-col gap-4">
                <h2 id="about" className={sectionTitle}>
                  About
                </h2>
                {agency.description.split(/\n\s*\n/).map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </section>
            )}

            <section aria-labelledby="services" className="flex flex-col gap-6">
              <h2 id="services" className={sectionTitle}>
                Services and industries
              </h2>
              <div className="flex flex-col gap-2">
                <h3 className="text-small">Services</h3>
                <ul className="flex flex-wrap gap-x-6">
                  {agency.services.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={`/${s.slug}`}
                        className="flex min-h-11 items-center text-accent hover:underline"
                      >
                        {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {agency.industries.length > 0 && primary && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-small">Industries</h3>
                  <ul className="flex flex-wrap gap-x-6">
                    {agency.industries.map((i) => (
                      <li key={i.slug}>
                        <Link
                          href={`/${primary.slug}/for-${i.slug}`}
                          className="flex min-h-11 items-center text-accent hover:underline"
                        >
                          {i.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {agency.caseStudies.length > 0 && (
              <section aria-labelledby="case-studies" className="flex flex-col gap-6">
                <h2 id="case-studies" className={sectionTitle}>
                  Case studies
                </h2>
                {agency.caseStudies.map((c) => {
                  const metrics = formatMetrics(c.metrics);
                  const channel = safeExternalUrl(c.channelUrl);
                  return (
                    <article
                      key={c.id}
                      className="flex flex-col gap-4 rounded-lg border border-line p-6"
                    >
                      <div className="flex flex-col gap-1">
                        <h3 className="text-h3">{c.title}</h3>
                        {c.industry && <p className="text-small">{c.industry.name}</p>}
                      </div>
                      {c.summary && <p>{c.summary}</p>}
                      {metrics.length > 0 && (
                        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                          {metrics.map(([label, value]) => (
                            <div key={label} className="flex flex-col-reverse justify-end gap-1">
                              <dt className="text-small">{label}</dt>
                              <dd className="text-h3">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {channel && (
                        <a
                          href={channel.href}
                          target="_blank"
                          rel="nofollow noopener"
                          className="flex min-h-11 items-center self-start text-accent hover:underline"
                        >
                          View channel<span aria-hidden>&nbsp;↗</span>
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      )}
                    </article>
                  );
                })}
              </section>
            )}

            <section
              aria-labelledby="reviews-heading"
              id="reviews"
              className="flex scroll-mt-16 flex-col gap-6"
            >
              <h2 className={sectionTitle} id="reviews-heading">
                Reviews
              </h2>
              {agency.reviews.length > 0 ? (
                <ul className="flex flex-col gap-6">
                  {agency.reviews.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-col gap-2 border-b border-line pb-6 last:border-0"
                    >
                      <Stars rating={r.rating} />
                      <p>{r.body}</p>
                      <p className="text-small">
                        {r.authorName}
                        {r.authorCompany && `, ${r.authorCompany}`} ·{" "}
                        {new Date(r.createdAt).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-2">No reviews yet.</p>
              )}
              <p className="text-small">Reviews are checked before they&apos;re published.</p>
            </section>

            <section
              aria-labelledby="contact-heading"
              id="contact"
              className="flex scroll-mt-16 flex-col gap-6 border-t border-line pt-12"
            >
              <h2 id="contact-heading" className={sectionTitle}>
                Contact {agency.name}
              </h2>
              <LazyContactForm agencySlug={agency.slug} agencyName={agency.name} />
            </section>
          </div>

          <aside
            aria-labelledby="facts"
            className="order-first flex flex-col gap-6 self-start lg:sticky lg:top-20 lg:order-none"
          >
            <div className="flex flex-col gap-4 rounded-lg bg-surface p-6">
              <h2 id="facts" className="text-h3">
                Key facts
              </h2>
              <dl className="flex flex-col gap-4">
                {facts.map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <dt className="text-small">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {!agency.isClaimed && (
              <p className="text-small">
                Is this your agency?{" "}
                <Link href={`/agency/${agency.slug}/claim`} className="text-accent hover:underline">
                  Claim this listing
                </Link>
              </p>
            )}
          </aside>
        </div>

        {similar.length > 0 && (
          <section
            aria-labelledby="similar"
            className="flex flex-col gap-6 border-t border-line pt-12"
          >
            <h2 id="similar" className={sectionTitle}>
              Similar agencies
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((a) => (
                <li key={a.id}>
                  <Link href={`/agency/${a.slug}`} className={rowLink}>
                    <span className="font-medium">{a.name}</span>
                    {a.tagline && <span className="text-small">{a.tagline}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
