import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock,
  Globe,
  MapPin,
  MessageSquare,
  Minus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgencyLogo, logoUrl } from "@/components/agency-logo";
import { AgencyTracker } from "@/components/agency-tracker";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { LazyContactForm } from "@/components/forms/lazy-contact-form";
import { JsonLd } from "@/components/json-ld";
import {
  getAgencyBySlug,
  getAgencySlugs,
  getIndexableCombos,
  getSimilarAgencies,
  type AgencyProfile,
} from "@/lib/data/agencies";
import { agencyWebsiteLink } from "@/lib/outbound";
import { contractLabel, responseLabel } from "@/lib/pricing";
import { formatMetrics, safeExternalUrl } from "@/lib/profile";
import { faq, glance, unitSuffix } from "@/lib/profile-copy";
import { profileMode } from "@/lib/profile-mode";
import { agencyDescription, agencyTitle } from "@/lib/profile-seo";
import { breadcrumbJsonLd, faqJsonLd, professionalServiceJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import { REVIEW_BUDGETS } from "@/lib/validation/review";

// Agency profile (docs/mockups/agency-profile.html). Everything comes from the agency's data;
// a section without data isn't rendered. Server component: the contact form and the analytics
// beacon are the only client parts.

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
  // The industry that takes 40%+ of their work, for "… Agency for <Industry>".
  const focus = [...agency.industryDetails]
    .filter((i) => (i.focusPct ?? 0) >= 40)
    .sort((a, b) => b.focusPct! - a.focusPct!)[0];
  return buildMetadata({
    image: `/og/agency/${agency.slug}`,
    title:
      agency.seoTitle ??
      agencyTitle({
        name: agency.name,
        service: agency.services[0]?.name ?? null,
        focusIndustry: focus?.name ?? null,
        city: agency.hqCity ?? agency.hqCountry,
        brand: BRAND_NAME,
      }),
    description:
      agency.seoDescription ??
      agencyDescription({
        name: agency.name,
        city: agency.hqCity ?? agency.hqCountry,
        service: agency.services[0]?.name ?? null,
        industries: agency.industries.map((i) => i.name),
        price: agency.minBudgetUsd,
        pricingModel: agency.pricingModel,
        minContract: agency.minContract,
      }),
    path: `/agency/${agency.slug}`,
    // Thin profiles stay out of Google until they're filled in (docs/SEO.md).
    noindex: agency.seoMissing.length > 0,
  });
}

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/** Bars and avatars cycle through the tile colours (DESIGN.md). */
const BAR = [
  "bg-(--pink)",
  "bg-(--amber)",
  "bg-(--coral)",
  "bg-accent",
  "bg-(--violet)",
  "bg-(--mint)",
];
const SOFT = [
  "bg-(--accent-soft)",
  "bg-(--violet-soft)",
  "bg-(--mint-soft)",
  "bg-(--coral-soft)",
  "bg-(--amber-soft)",
  "bg-(--pink-soft)",
];

const PRICE_RANGE_UNIT: Record<string, string> = {
  retainer: "month",
  performance: "month",
  per_video: "video",
  project: "project",
};
const UNIT_TEXT: Record<string, string> = {
  retainer: "per month, retainer",
  per_video: "per video",
  project: "per project",
  performance: "per month, performance-based",
};
const REPORTING_LEDE: Record<string, string> = {
  weekly: "Reports every week.",
  biweekly: "Reports every two weeks.",
  monthly: "Reports every month.",
};

const sectionCls = "scroll-mt-20 border-t border-line-2 py-9 first:border-t-0 first:pt-0";
const h2 = "mb-1.5 text-[24px] leading-tight font-[650] tracking-[-0.025em]";
const lede = "mb-5 text-[15px] text-text-2";
const card = "rounded-[16px] border border-line bg-raised";
const btn =
  "inline-flex h-[46px] items-center justify-center gap-2 rounded-full px-[22px] text-[15px] font-semibold whitespace-nowrap transition-[transform,border-color] duration-150";
const btnPrimary = `${btn} bg-accent text-on-accent shadow-[0_1px_2px_rgba(31,94,255,.3),0_8px_20px_-6px_rgba(31,94,255,.45)] motion-safe:hover:-translate-y-px`;
const btnLight = `${btn} border border-line bg-raised text-text hover:border-text-2`;

export default async function AgencyPage({ params }: PageProps<"/agency/[slug]">) {
  const agency = await load(params);
  const e = agency.entitlements;
  const [similar, combos] = await Promise.all([
    // Unmanaged profiles only: managed agencies a visitor can actually reach.
    e.showSimilarAgencies ? getSimilarAgencies(agency, 3) : [],
    getIndexableCombos(),
  ]);

  const primary = agency.services[0];
  const website = safeExternalUrl(agency.website);
  // Managed (Pro) only: a website link, sponsored and UTM-tagged (lib/outbound.ts).
  const websiteLink = agencyWebsiteLink(agency.website, e.plan, "profile");

  // Location facts: HQ (city, country) plus up to two other places they work.
  const { hqCity, hqCountry } = agency;
  const otherPlaces = agency.locations
    .map((l) => l.name)
    .filter((n) => n !== agency.hq?.name && n !== hqCountry);

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
  const replies = e.responseTime ? responseLabel(agency.response?.medianMinutes ?? null) : null;
  const replyCount = agency.response?.contacted ?? null;

  const breadcrumbs = [
    { name: "Home", path: "/" },
    ...(primary ? [{ name: `${primary.name} agencies`, path: `/${primary.slug}` }] : []),
    { name: agency.name, path: `/agency/${agency.slug}` },
  ];

  const copyInput = {
    name: agency.name,
    city: hqCity,
    country: hqCountry,
    foundedYear: agency.foundedYear,
    teamSize: agency.teamSize,
    services: agency.services.map((s) => s.name),
    industries: agency.industries.map((i) => i.name),
    startingPrice: agency.minBudgetUsd,
    pricingModel: agency.pricingModel,
    minContract: agency.minContract,
    adSpend: agency.adSpend,
    setupFee: agency.setupFeeUsd,
  };
  const atAGlance = glance(copyInput);
  const questions = faq({
    ...copyInput,
    industryFocus: agency.industryDetails.map((i) => ({ name: i.name, pct: i.focusPct })),
    otherLocations: otherPlaces,
    replyLabel: replies,
    replyCount,
  });

  const caseStudies = agency.caseStudies.slice(0, e.caseStudies);
  const confirmedChannels = agency.channels.filter((c) => c.confirmed).length;
  const v = agency.verificationRecord;
  const domain = website?.hostname.replace(/^www\./, "");
  const price = agency.minBudgetUsd;
  const suffix = unitSuffix(agency.pricingModel);
  const mode = profileMode({
    managed: e.managed,
    name: agency.name,
    slug: agency.slug,
    mainService: primary?.slug ?? null,
    mainIndustry: agency.industries[0]?.slug ?? null,
  });
  // The Get matched click isn't an agency event (nothing reaches the agency): untracked.
  const ctaTrack = mode.kind === "contact" ? "contact_open" : undefined;
  // /claim/<slug> handles every case: sign in, confirm, request access, or straight to Pro.
  const manageHref = `/claim/${agency.slug}`;

  // Related directory pages: the main service for their industries and HQ country, if indexed.
  const indexed = new Set(combos.map((c) => `${c.serviceSlug}|${c.segment}`));
  const related = primary
    ? [
        ...agency.industries.slice(0, 3).map((i) => ({
          href: `/${primary.slug}/for-${i.slug}`,
          label: `${primary.name} agencies for ${i.name.toLowerCase()}`,
          key: `${primary.slug}|for-${i.slug}`,
        })),
        ...agency.locations
          .filter((l) => l.type === "country")
          .slice(0, 2)
          .map((l) => ({
            href: `/${primary.slug}/in-${l.slug}`,
            label: `${primary.name} agencies in ${l.name}`,
            key: `${primary.slug}|in-${l.slug}`,
          })),
      ].filter((r) => indexed.has(r.key))
    : [];
  // Always at least the service pages they're listed on.
  const serviceLinks = agency.services.map((s) => ({
    href: `/${s.slug}`,
    label: `${s.name} agencies`,
  }));
  const relatedLinks = [...related, ...serviceLinks].slice(0, 6);

  return (
    <>
      <AgencyTracker agencyId={agency.id} agencySlug={agency.slug} />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <JsonLd
        data={professionalServiceJsonLd({
          slug: agency.slug,
          name: agency.name,
          description: atAGlance,
          logoUrl: agency.logoPath ? logoUrl(agency.logoPath) : null,
          areaServed: agency.locations.map((l) => l.name),
          hq: agency.hq ? { city: hqCity, country: hqCountry } : null,
          foundingYear: agency.foundedYear,
          teamSize: agency.teamSize,
          priceRange:
            price !== null
              ? `${usd(price)}+${agency.pricingModel ? `/${PRICE_RANGE_UNIT[agency.pricingModel]}` : ""}`
              : null,
          knowsAbout: agency.services.map((s) => s.name),
          sameAs: [
            // The website only where we link to it (managed).
            websiteLink ? website?.href : null,
            agency.linkedinUrl,
            agency.youtubeChannelUrl,
          ].filter((u): u is string => !!u),
          rating,
          reviews: agency.reviews.map((r) => ({
            author: r.authorName,
            rating: r.rating,
            body: r.body,
            date: r.createdAt,
          })),
        })}
      />
      {questions.length > 0 && <JsonLd data={faqJsonLd(questions)} />}

      <div className="mx-auto max-w-content px-4 md:px-6">
        <div className="pt-7">
          <Breadcrumbs items={breadcrumbs} />
        </div>

        {/* Header */}
        <header className="grid gap-4 border-b border-line pt-7 pb-8 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-6">
          <AgencyLogo name={agency.name} logoPath={agency.logoPath} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[clamp(30px,4vw,42px)] leading-[1.05] font-[650] tracking-[-0.035em]">
                {agency.name}
              </h1>
              {agency.isVerified && (
                <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-(--mint-soft) px-2.5 text-[12.5px] font-semibold text-(--mint)">
                  <Check className="size-[13px] [stroke-width:2.5]" aria-hidden />
                  Verified
                </span>
              )}
            </div>
            {agency.bestFor && (
              <p className="mt-2.5 max-w-[40em] text-[18px] text-text-2">
                Best for{" "}
                <span className="font-semibold text-text">{lowerFirst(agency.bestFor)}</span>
              </p>
            )}
            {(agency.hq ||
              agency.teamSize ||
              agency.foundedYear ||
              agency.languages.length > 0 ||
              agency.timezone) && (
              <ul className="mt-[18px] flex flex-wrap gap-x-[22px] gap-y-2.5 text-[14px] text-text-2">
                {agency.hq && (
                  <Fact icon={MapPin}>
                    <b className="font-semibold text-text">
                      {[hqCity, hqCountry].filter(Boolean).join(", ")}
                    </b>
                    {otherPlaces.length > 0 &&
                      ` + ${otherPlaces.slice(0, 2).join(", ")}${otherPlaces.length > 2 ? ` and ${otherPlaces.length - 2} more` : ""}`}
                  </Fact>
                )}
                {agency.teamSize && (
                  <Fact icon={Users}>
                    <b className="font-semibold text-text">{agency.teamSize.replace("-", "–")}</b>{" "}
                    people
                  </Fact>
                )}
                {agency.foundedYear && (
                  <Fact icon={CalendarDays}>
                    Since{" "}
                    <b className="font-semibold text-text tabular-nums">{agency.foundedYear}</b>
                  </Fact>
                )}
                {agency.languages.length > 0 && (
                  <Fact icon={Globe}>{agency.languages.join(", ")}</Fact>
                )}
                {agency.timezone && <Fact icon={Clock}>{agency.timezone}</Fact>}
              </ul>
            )}
            <div className="mt-[22px] flex flex-wrap gap-2.5">
              <a href={mode.ctaHref} data-track={ctaTrack} className={btnPrimary}>
                {mode.ctaLabel}
              </a>
              {websiteLink && <WebsiteButton link={websiteLink} className={btnLight} />}
            </div>
            {mode.note && <p className="mt-3 max-w-[40em] text-[14px] text-text-2">{mode.note}</p>}
          </div>
        </header>

        <div className="grid items-start gap-14 pt-10 pb-20 min-[980px]:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <section id="glance" aria-labelledby="glance-h" className={sectionCls}>
              <h2 id="glance-h" className={h2}>
                At a glance
              </h2>
              <p className="mt-3 max-w-[42em] text-[18px] leading-[1.65]">{atAGlance}</p>
              <p className="mt-3 text-[13px] text-text-2">
                Written by {BRAND_NAME} from the agency&apos;s profile details.
              </p>
            </section>

            <PricingSection agency={agency} />
            <FocusSection agency={agency} primarySlug={primary?.slug ?? null} />
            <ServicesSection agency={agency} />

            {agency.channels.length > 0 && (
              <section id="channels" aria-labelledby="channels-h" className={sectionCls}>
                <h2 id="channels-h" className={h2}>
                  Channels they&apos;ve worked on
                </h2>
                <p className={lede}>
                  Subscriber counts come from YouTube. &ldquo;Confirmed&rdquo; means the channel
                  owner confirmed the work to us.
                </p>
                <ul className="grid gap-3 min-[760px]:grid-cols-3">
                  {agency.channels.map((c, i) => (
                    <li key={c.id}>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="nofollow noopener"
                        className={cn(
                          card,
                          "flex h-full flex-col gap-2.5 p-4 transition-colors duration-150 hover:border-text-2",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            aria-hidden
                            className={cn(
                              "grid size-10 shrink-0 place-items-center rounded-full text-[14px] font-[650] text-text",
                              SOFT[i % SOFT.length],
                            )}
                          >
                            {initials(c.title ?? "YT")}
                          </span>
                          <span className="min-w-0">
                            <b className="block truncate text-[14.5px] font-semibold">
                              {c.title ?? channelHandle(c.url)}
                            </b>
                            {c.subscribers !== null && (
                              <span className="text-[13px] text-text-2 tabular-nums">
                                {compact(c.subscribers)} subscribers
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="mt-auto flex items-center justify-between gap-2 text-[13px] text-text-2">
                          <span>{c.industry}</span>
                          {c.confirmed ? (
                            <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-(--mint)">
                              <Check className="size-[13px] [stroke-width:2.5]" aria-hidden />
                              Confirmed
                            </span>
                          ) : (
                            <span className="text-[12.5px]">Listed by agency</span>
                          )}
                        </span>
                        <span className="sr-only"> (opens YouTube in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {caseStudies.length > 0 && (
              <section id="cases" aria-labelledby="cases-h" className={sectionCls}>
                <h2 id="cases-h" className={h2}>
                  {caseStudies.length === 1 ? "Case study" : "Case studies"}
                </h2>
                <div className="mt-4 flex flex-col gap-4">
                  {caseStudies.map((c) => {
                    const metrics = formatMetrics(c.metrics);
                    const tag = [c.industry?.name, c.service?.name].filter(Boolean).join(", ");
                    return (
                      <article key={c.id} className={cn(card, "overflow-hidden rounded-[20px]")}>
                        <div className="px-6 pt-[22px] pb-[22px]">
                          {tag && (
                            <span className="inline-flex rounded-full bg-(--violet-soft) px-2.5 py-0.5 text-[12.5px] font-semibold text-(--violet-on-soft)">
                              {tag}
                            </span>
                          )}
                          <h3 className="mt-3 mb-1.5 text-[19px] font-[650] tracking-[-0.015em]">
                            {c.title}
                          </h3>
                          {c.summary && <p className="text-[15px] text-text-2">{c.summary}</p>}
                        </div>
                        {metrics.length > 0 && (
                          <dl className="grid border-t border-line-2 min-[620px]:grid-cols-3">
                            {metrics.map(([label, value]) => (
                              <div
                                key={label}
                                className="flex flex-col-reverse border-b border-line-2 px-6 py-4 last:border-b-0 min-[620px]:border-r min-[620px]:border-b-0 min-[620px]:last:border-r-0"
                              >
                                <dt className="text-[12.5px] text-text-2">{label}</dt>
                                <dd className="text-[24px] font-[650] tracking-[-0.02em] tabular-nums">
                                  {value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {agency.process.length > 0 && (
              <section id="process" aria-labelledby="process-h" className={sectionCls}>
                <h2 id="process-h" className={h2}>
                  How they work
                </h2>
                {agency.reportingFrequency && (
                  <p className={lede}>{REPORTING_LEDE[agency.reportingFrequency]}</p>
                )}
                <ol className="mt-2 flex flex-col">
                  {agency.process.map((s, i) => (
                    <li
                      key={i}
                      className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-3.5 py-3.5 [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:top-[46px] [&:not(:last-child)]:before:-bottom-1.5 [&:not(:last-child)]:before:left-[15px] [&:not(:last-child)]:before:w-0.5 [&:not(:last-child)]:before:bg-line-2 [&:not(:last-child)]:before:content-['']"
                    >
                      <span
                        aria-hidden
                        className="grid size-8 place-items-center rounded-full bg-(--accent-soft) text-[14px] font-[650] text-(--accent-on-soft)"
                      >
                        {i + 1}
                      </span>
                      <div>
                        <b className="block text-[15.5px] font-semibold">{s.title}</b>
                        {s.description && (
                          <span className="text-[14.5px] text-text-2">{s.description}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {v && (
              <section id="verified" aria-labelledby="verified-h" className={sectionCls}>
                <h2 id="verified-h" className={h2}>
                  What was verified
                </h2>
                <p className={lede}>
                  Checked by {BRAND_NAME} on {longDate(v.checkedAt)}.{" "}
                  <Link href="/how-we-rank" className="text-accent hover:underline">
                    How verification works
                  </Link>
                </p>
                <ul className={cn(card, "overflow-hidden")}>
                  <CheckRow
                    done={v.domain}
                    title={
                      v.domain
                        ? "Business email matches the website"
                        : "Business email not matched to the website"
                    }
                    text={
                      v.domain
                        ? domain
                          ? `The profile is run by someone at ${domain}.`
                          : "The agency's email domain matches its website."
                        : "We haven't checked this yet."
                    }
                  />
                  <CheckRow
                    done={v.business}
                    title={
                      v.business ? "Business details reviewed" : "Business details not reviewed"
                    }
                    text={
                      v.business
                        ? "Website, company details and contact information."
                        : "We haven't checked this yet."
                    }
                  />
                  <CheckRow
                    done={v.ownership && v.channelsChecked > 0}
                    title={
                      v.ownership && v.channelsChecked > 0
                        ? `${v.channelsChecked} YouTube ${v.channelsChecked === 1 ? "channel" : "channels"} checked`
                        : "YouTube channels not checked"
                    }
                    text={
                      v.ownership && v.channelsChecked > 0
                        ? "The agency showed it runs or manages them, and we read their stats from YouTube."
                        : "We haven't checked this yet."
                    }
                  />
                  <CheckRow
                    done={confirmedChannels > 0}
                    title={
                      confirmedChannels > 0
                        ? `${confirmedChannels} client ${confirmedChannels === 1 ? "channel" : "channels"} confirmed`
                        : "No client channels confirmed yet"
                    }
                    text={
                      confirmedChannels > 0
                        ? "The channel owners confirmed the work to us."
                        : "Channels marked “Listed by agency” are the agency's own claim."
                    }
                  />
                  <CheckRow
                    done={false}
                    title="Results not independently checked"
                    text="Case study numbers are reported by the agency."
                  />
                </ul>
              </section>
            )}

            {agency.reviews.length > 0 && (
              <section id="reviews" aria-labelledby="reviews-h" className={sectionCls}>
                <h2 id="reviews-h" className={h2}>
                  Reviews
                </h2>
                <p className={lede}>
                  Only businesses that contacted the agency through {BRAND_NAME} can leave a review.
                </p>
                <div className="flex flex-col gap-4">
                  {agency.reviews.map((r) => (
                    <ReviewCard key={r.id} review={r} />
                  ))}
                </div>
              </section>
            )}

            {agency.description && (
              <section id="words" aria-labelledby="words-h" className={sectionCls}>
                <h2 id="words-h" className={h2}>
                  In their words
                </h2>
                <p className={lede}>Written by the agency.</p>
                <div className="flex max-w-[42em] flex-col gap-3 border-l-[3px] border-line py-1 pl-[18px]">
                  {agency.description.split(/\n\s*\n/).map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </section>
            )}

            {questions.length > 0 && (
              <section id="faq" aria-labelledby="faq-h" className={sectionCls}>
                <h2 id="faq-h" className={h2}>
                  Questions about {agency.name}
                </h2>
                <div className="mt-2">
                  {questions.map((q, i) => (
                    <details key={q.question} open={i === 0} className="group border-b border-line">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                        {q.question}
                        <span
                          aria-hidden
                          className="grid size-[26px] shrink-0 place-items-center rounded-full bg-surface transition-transform duration-200 group-open:rotate-180"
                        >
                          <span className="block size-[7px] -translate-y-0.5 rotate-45 border-r-2 border-b-2 border-text-2" />
                        </span>
                      </summary>
                      <p className="mb-[18px] max-w-[42em] text-[15px] text-text-2">{q.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {(similar.length > 0 || relatedLinks.length > 0) && (
              <section id="related" aria-labelledby="related-h" className={sectionCls}>
                <h2 id="related-h" className={h2}>
                  {similar.length > 0 ? "Compare with similar agencies" : "Related agencies"}
                </h2>
                {similar.length > 0 && (
                  <ul className="mt-4 grid gap-3 min-[760px]:grid-cols-3">
                    {similar.map((a, i) => (
                      <li key={a.id}>
                        <Link
                          href={`/agency/${a.slug}`}
                          className={cn(
                            card,
                            "flex h-full items-center gap-3 p-3.5 transition-colors duration-150 hover:border-text-2",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "grid size-10 shrink-0 place-items-center rounded-[11px] text-[14px] font-[650] text-text",
                              SOFT[(i + 2) % SOFT.length],
                            )}
                          >
                            {initials(a.name)}
                          </span>
                          <span className="min-w-0">
                            <b className="block truncate text-[14.5px] font-semibold">{a.name}</b>
                            <span className="text-[12.5px] text-text-2">
                              {[
                                a.services[0]?.name,
                                a.minBudgetUsd !== null &&
                                  `from ${usd(a.minBudgetUsd)}${unitSuffix(a.pricingModel)}`,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {relatedLinks.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {relatedLinks.map((l) => (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          className="inline-flex min-h-9 items-center rounded-full bg-surface px-3 text-[13.5px] transition-colors duration-150 hover:text-accent"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {mode.kind === "contact" && (
              <section id="contact" aria-labelledby="contact-h" className={sectionCls}>
                <h2 id="contact-h" className={h2}>
                  {mode.ctaLabel}
                </h2>
                <p className={lede}>
                  Your message goes straight to the agency.
                  {replies && ` They ${replies.replace(/^Usually replies/, "usually reply")}.`}
                </p>
                <LazyContactForm agencySlug={agency.slug} agencyName={agency.name} />
              </section>
            )}

            <div className="flex flex-wrap justify-between gap-2 pt-7 text-[13px] text-text-2">
              <span>Last updated {longDate(agency.updatedAt)}</span>
              <span className="min-[980px]:hidden">
                Is this your agency?{" "}
                <Link href={manageHref} rel="nofollow" className="text-accent hover:underline">
                  Manage this listing
                </Link>
              </span>
              <span>
                Something wrong?{" "}
                <Link
                  href={`/contact?topic=report&agency=${agency.slug}`}
                  rel="nofollow"
                  className="text-accent hover:underline"
                >
                  Report this listing
                </Link>
              </span>
            </div>
          </div>

          {/* Sticky decision card (desktop) */}
          <aside aria-label="Summary" className="sticky top-[84px] hidden gap-3.5 min-[980px]:grid">
            <div className="rounded-[22px] border border-line bg-raised p-[22px] shadow-[0_1px_2px_rgba(20,25,40,.05),0_12px_32px_-12px_rgba(20,25,40,.14)]">
              <p className="text-[13px] text-text-2">Starting price</p>
              <p className="text-[30px] leading-[1.1] font-[650] tracking-[-0.025em] tabular-nums">
                {price !== null ? (
                  <>
                    {usd(price)}
                    <small className="text-[15px] font-medium text-text-2">{suffix}</small>
                  </>
                ) : (
                  "On request"
                )}
              </p>
              <SideChips agency={agency} />
              <a href={mode.ctaHref} data-track={ctaTrack} className={cn(btnPrimary, "w-full")}>
                {mode.ctaLabel}
              </a>
              {mode.note && <p className="mt-3 text-[13px] text-text-2">{mode.note}</p>}
              {websiteLink && (
                <WebsiteButton link={websiteLink} className={cn(btnLight, "mt-2.5 w-full")} />
              )}
              {replies && (
                <div className="mt-4 flex gap-2.5 border-t border-line-2 pt-4 text-[14px]">
                  <MessageSquare className="mt-0.5 size-[18px] shrink-0 text-accent" aria-hidden />
                  <div>
                    {replies}
                    <span className="block text-[12.5px] text-text-2 tabular-nums">
                      Based on {replyCount} inquiries in the last 90 days
                    </span>
                  </div>
                </div>
              )}
            </div>
            <VerifiedMini agency={agency} confirmedChannels={confirmedChannels} />
            <p className="px-1 text-[13px] text-text-2">
              Is this your agency?{" "}
              <Link href={manageHref} rel="nofollow" className="text-accent hover:underline">
                Manage this listing
              </Link>
            </p>
          </aside>
        </div>
      </div>

      {/* Contact bar (mobile): the price, the reply time and one button. */}
      <div
        aria-label={mode.kind === "contact" ? "Contact bar" : "Get matched bar"}
        className="profile-mbar fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-bg/80 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] backdrop-blur-[20px] min-[980px]:hidden print:hidden"
      >
        <div className="min-w-0">
          <b className="block truncate text-[17px] font-semibold tabular-nums">
            {price !== null ? `${usd(price)}${suffix}` : agency.name}
          </b>
          {replies && <span className="block truncate text-[12.5px] text-text-2">{replies}</span>}
        </div>
        <a
          href={mode.ctaHref}
          data-track={ctaTrack}
          className={cn(btnPrimary, "h-[38px] px-[18px] text-[14px]")}
        >
          {mode.kind === "contact" ? "Contact" : "Get matched"}
        </a>
      </div>
    </>
  );
}

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const compact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
/** "@handle" from a channel link, when we don't have the title yet. */
function channelHandle(url: string) {
  const m = url.match(/youtube\.com\/(@[\w.-]+|c\/[\w.-]+|channel\/[\w-]+|user\/[\w.-]+)/i);
  return m ? m[1] : "YouTube channel";
}

function Fact({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-[7px]">
      <Icon className="size-4 [stroke-width:1.8] text-text-2" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function WebsiteButton({
  link,
  className,
}: {
  link: NonNullable<ReturnType<typeof agencyWebsiteLink>>;
  className: string;
}) {
  return (
    <a
      href={link.href}
      target={link.target}
      // SECURITY.md: paid placements are marked sponsored (lib/outbound.ts).
      rel={link.rel}
      data-track="website_click"
      data-source="profile"
      className={className}
    >
      Visit website
      <ArrowUpRight className="size-4" aria-hidden />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function PricingSection({ agency }: { agency: AgencyProfile }) {
  const cells: { label: string; value: string; note?: string }[] = [];
  if (agency.minBudgetUsd !== null)
    cells.push({
      label: "Starting price",
      value: usd(agency.minBudgetUsd),
      note: agency.pricingModel ? UNIT_TEXT[agency.pricingModel] : undefined,
    });
  if (agency.minContract) {
    const m = agency.minContract.match(/^(\d+)_months?$/)?.[1];
    cells.push({
      label: "Minimum contract",
      value: agency.minContract === "none" ? "None" : `${m} ${m === "1" ? "month" : "months"}`,
      note: agency.minContract === "none" ? "no minimum term" : undefined,
    });
  }
  if (agency.adSpend === "separate")
    cells.push({ label: "Ad spend", value: "Separate", note: "paid to Google" });
  if (agency.adSpend === "included")
    cells.push({ label: "Ad spend", value: "Included", note: "in the price" });
  if (agency.setupFeeUsd !== null)
    cells.push(
      agency.setupFeeUsd === 0
        ? { label: "Setup fee", value: "None" }
        : { label: "Setup fee", value: usd(agency.setupFeeUsd), note: "one time" },
    );
  const servicePrices = agency.serviceDetails.filter((s) => s.startingPrice !== null);
  if (cells.length === 0 && servicePrices.length === 0) return null;

  return (
    <section id="pricing" aria-labelledby="pricing-h" className={sectionCls}>
      <h2 id="pricing-h" className={h2}>
        Pricing
      </h2>
      <p className={lede}>What you&apos;ll pay and what you&apos;re committing to.</p>
      {cells.length > 0 && (
        // Hairlines are the 1px gaps showing the line colour behind the cells.
        <dl
          className={cn(
            "grid gap-px overflow-hidden rounded-[18px] border border-line bg-line-2",
            cells.length === 1 ? "grid-cols-1 sm:max-w-[50%]" : "grid-cols-2",
            cells.length >= 3 && "min-[760px]:grid-cols-(--cols)",
          )}
          style={{ "--cols": `repeat(${cells.length}, minmax(0, 1fr))` } as React.CSSProperties}
        >
          {cells.map((c) => (
            <div
              key={c.label}
              className={cn(
                "flex flex-col bg-raised px-5 py-[18px]",
                // An odd last cell on the 2-column (mobile) grid takes the whole row.
                cells.length > 1 && "last:odd:col-span-2",
                cells.length >= 3 && "min-[760px]:last:odd:col-span-1",
              )}
            >
              <dt className="text-[12.5px] text-text-2">{c.label}</dt>
              <dd className="mt-1 text-[18px] font-[650] tracking-[-0.01em] tabular-nums">
                {c.value}
              </dd>
              {c.note && <dd className="text-[12.5px] text-text-2">{c.note}</dd>}
            </div>
          ))}
        </dl>
      )}
      {servicePrices.length > 0 && (
        <dl className="mt-3.5 flex flex-col tabular-nums">
          {servicePrices.map((s) => (
            <div
              key={s.slug}
              className="flex justify-between gap-3 border-b border-dashed border-line py-2.5 text-[14.5px] last:border-b-0"
            >
              <dt>{s.name}</dt>
              <dd className="font-semibold">
                from {usd(s.startingPrice!)}
                {unitSuffix(s.priceUnit ?? agency.pricingModel)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function FocusSection({
  agency,
  primarySlug,
}: {
  agency: AgencyProfile;
  primarySlug: string | null;
}) {
  const services = agency.serviceDetails
    .filter((s) => (s.focusPct ?? 0) > 0)
    .sort((a, b) => b.focusPct! - a.focusPct!);
  const industries = agency.industryDetails
    .filter((i) => (i.focusPct ?? 0) > 0)
    .sort((a, b) => b.focusPct! - a.focusPct!);
  if (!services.length && !industries.length) return null;

  const column = (
    title: string,
    rows: { slug: string; name: string; focusPct: number | null }[],
    href: (slug: string) => string | null,
    offset: number,
  ) =>
    rows.length > 0 && (
      <div>
        <h3 className="mb-3.5 text-[15px] font-semibold">{title}</h3>
        <ul className="flex flex-col gap-3.5">
          {rows.map((r, i) => {
            const to = href(r.slug);
            return (
              <li
                key={r.slug}
                className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-x-3 gap-y-1.5 text-[14.5px]"
              >
                {to ? (
                  <Link href={to} className="truncate hover:text-accent">
                    {r.name}
                  </Link>
                ) : (
                  <span className="truncate">{r.name}</span>
                )}
                <span className="text-right text-[13.5px] text-text-2 tabular-nums">
                  {r.focusPct}%
                </span>
                <span
                  aria-hidden
                  className="col-span-2 h-2 overflow-hidden rounded-full bg-surface"
                >
                  <span
                    className={cn("block h-full rounded-full", BAR[(i + offset) % BAR.length])}
                    style={{ width: `${r.focusPct}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );

  return (
    <section id="focus" aria-labelledby="focus-h" className={sectionCls}>
      <h2 id="focus-h" className={h2}>
        Where they focus
      </h2>
      <p className={lede}>
        Share of their work by service and by client industry, as reported by the agency.
      </p>
      <div className="grid gap-8 min-[700px]:grid-cols-2">
        {column("Services", services, (slug) => `/${slug}`, 0)}
        {column(
          "Industries",
          industries,
          (slug) => (primarySlug ? `/${primarySlug}/for-${slug}` : null),
          3,
        )}
      </div>
    </section>
  );
}

function ServicesSection({ agency }: { agency: AgencyProfile }) {
  // Only worth a section when there's more than the names (which "At a glance" already lists).
  if (!agency.serviceDetails.some((s) => s.included.length > 0 || s.startingPrice !== null))
    return null;
  return (
    <section id="services" aria-labelledby="services-h" className={sectionCls}>
      <h2 id="services-h" className={h2}>
        Services
      </h2>
      <p className={lede}>What&apos;s included in each service.</p>
      <ul className="flex flex-col gap-3">
        {agency.serviceDetails.map((s) => (
          <li key={s.slug} className={cn(card, "px-5 py-[18px]")}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-[16.5px] font-[650]">
                <Link href={`/${s.slug}`} className="hover:underline">
                  {s.name}
                </Link>
              </h3>
              {s.startingPrice !== null && (
                <span className="text-[13.5px] text-text-2 tabular-nums">
                  from {usd(s.startingPrice)}
                  {unitSuffix(s.priceUnit ?? agency.pricingModel)}
                </span>
              )}
            </div>
            {s.included.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {s.included.map((item) => (
                  <li key={item} className="rounded-full bg-surface px-2.5 py-1 text-[13px]">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CheckRow({ done, title, text }: { done: boolean; title: string; text: string }) {
  return (
    <li className="flex items-start gap-3.5 border-b border-line-2 px-[18px] py-4 last:border-b-0">
      <span
        aria-hidden
        className={cn(
          "grid size-[26px] shrink-0 place-items-center rounded-full",
          done ? "bg-(--mint-soft) text-(--mint)" : "bg-surface text-text-2",
        )}
      >
        {done ? (
          <Check className="size-3.5 [stroke-width:2.5]" />
        ) : (
          <Minus className="size-3.5 [stroke-width:2.5]" />
        )}
      </span>
      <div>
        <b className="block text-[15px] font-semibold">
          <span className="sr-only">{done ? "Checked: " : "Not checked: "}</span>
          {title}
        </b>
        <span className="text-[13.5px] text-text-2">{text}</span>
      </div>
    </li>
  );
}

const MONTH = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
const YEAR = (iso: string) => iso.slice(0, 4);
function projectDates(start: string | null, end: string | null) {
  if (!start) return null;
  if (!end) return `Since ${MONTH(start)} ${YEAR(start)}`;
  return YEAR(start) === YEAR(end)
    ? `${MONTH(start)}–${MONTH(end)} ${YEAR(end)}`
    : `${MONTH(start)} ${YEAR(start)}–${MONTH(end)} ${YEAR(end)}`;
}

function ReviewCard({ review: r }: { review: AgencyProfile["reviews"][number] }) {
  // The first sentence is the headline quote; the rest follows as body text.
  const match = r.body.match(/^(.+?[.!?])(\s+|$)([\s\S]*)$/);
  const quote = match ? match[1] : r.body;
  const rest = match ? match[3].trim() : "";
  const project = [
    r.service,
    REVIEW_BUDGETS.find((b) => b.value === r.budgetRange)?.label,
    projectDates(r.projectStart, r.projectEnd),
  ].filter(Boolean);
  const who = [
    r.authorCompany,
    r.reviewerIndustry,
    r.reviewerCompanySize && `${r.reviewerCompanySize.replace("-", "–")} employees`,
    r.reviewerCountry,
  ].filter(Boolean);
  const overall = r.overall ?? r.rating;
  const scores = r.scores
    ? ([
        ["Quality", r.scores.quality],
        ["Schedule", r.scores.schedule],
        ["Cost", r.scores.cost],
        ["Would refer", r.scores.refer],
      ] as const)
    : [];

  return (
    <article className="grid overflow-hidden rounded-[20px] border border-line bg-raised min-[700px]:grid-cols-[minmax(0,1fr)_200px]">
      <div className="px-6 py-[22px]">
        {project.length > 0 && (
          <p className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-text-2 tabular-nums">
            {project.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </p>
        )}
        <blockquote className="mt-3.5 mb-2 text-[18px] leading-[1.4] font-semibold tracking-[-0.01em]">
          &ldquo;{quote}&rdquo;
        </blockquote>
        {rest && <p className="text-[14.5px] text-text-2">{rest}</p>}
        <div className="mt-[18px] flex items-center gap-2.5 border-t border-line-2 pt-4 text-[13.5px]">
          <span
            aria-hidden
            className="grid size-[34px] shrink-0 place-items-center rounded-full bg-(--mint-soft) text-[12px] font-[650] text-text"
          >
            {initials(r.authorName)}
          </span>
          <div>
            <b className="font-semibold">{r.reviewerTitle ?? r.authorName}</b>
            {who.length > 0 && <span className="block text-text-2">{who.join(", ")}</span>}
          </div>
        </div>
      </div>
      <div className="grid content-start gap-2.5 border-t border-line-2 bg-surface px-5 py-[22px] tabular-nums min-[700px]:border-t-0 min-[700px]:border-l">
        <p className="flex items-baseline gap-1.5">
          <b className="text-[32px] font-[650] tracking-[-0.02em]">{overall.toFixed(1)}</b>
          <span className="text-[13px] text-text-2">overall</span>
        </p>
        {scores.length > 0 && (
          <dl className="grid gap-2.5">
            {scores.map(([label, value]) => (
              <div key={label} className="flex justify-between text-[13.5px]">
                <dt className="text-text-2">{label}</dt>
                <dd className="font-semibold">{value.toFixed(1)}</dd>
              </div>
            ))}
          </dl>
        )}
        {r.verifiedClient && (
          <span className="mt-1.5 inline-flex h-[26px] items-center gap-1.5 justify-self-start rounded-full bg-(--mint-soft) px-2.5 text-[12.5px] font-semibold text-(--mint)">
            <Check className="size-[13px] [stroke-width:2.5]" aria-hidden />
            Verified client
          </span>
        )}
      </div>
    </article>
  );
}

function SideChips({ agency }: { agency: AgencyProfile }) {
  const contract = contractLabel(agency.minContract);
  const adSpend =
    agency.adSpend === "separate"
      ? "Ad spend separate"
      : agency.adSpend === "included"
        ? "Ad spend included"
        : null;
  if (!contract && !adSpend && !agency.isVerified) return <div className="mb-4" />;
  const chip = "inline-flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-medium";
  return (
    <div className="mt-3 mb-4 flex flex-wrap gap-1.5">
      {contract && <span className={cn(chip, "bg-surface")}>{contract}</span>}
      {adSpend && <span className={cn(chip, "bg-surface")}>{adSpend}</span>}
      {agency.isVerified && (
        <span className={cn(chip, "bg-(--mint-soft) text-(--mint)")}>Verified</span>
      )}
    </div>
  );
}

function VerifiedMini({
  agency,
  confirmedChannels,
}: {
  agency: AgencyProfile;
  confirmedChannels: number;
}) {
  const v = agency.verificationRecord;
  const done = [
    v?.domain && "Business email",
    v?.business && "Business details",
    v?.ownership &&
      v.channelsChecked > 0 &&
      `${v.channelsChecked} YouTube ${v.channelsChecked === 1 ? "channel" : "channels"}`,
    confirmedChannels > 0 &&
      `${confirmedChannels} client ${confirmedChannels === 1 ? "channel" : "channels"}`,
  ].filter((x): x is string => Boolean(x));
  if (!done.length) return null;
  return (
    <div className="rounded-[18px] border border-line bg-raised px-[18px] py-4 text-[13.5px]">
      <h2 className="mb-2.5 text-[13.5px] font-[650]">Verified by {BRAND_NAME}</h2>
      <ul>
        {done.map((d) => (
          <li key={d} className="flex items-center gap-2 py-1 text-text-2">
            <Check className="size-3.5 [stroke-width:2.5] text-(--mint)" aria-hidden />
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
}
