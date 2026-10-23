import { ArrowRight, BadgeCheck, ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";

import { BrowseSync, FilterSheet } from "@/components/agencies/browse-client";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AgencyCard } from "@/components/directory/agency-card";
import { JsonLd } from "@/components/json-ld";
import {
  BROWSE_BUDGETS,
  BROWSE_FORM,
  BROWSE_SORTS,
  browse,
  browseDescription,
  browseQuery,
  browseRobots,
  browseTitle,
  filterCount,
  isFiltered,
  pageNumbers,
  parseBrowse,
  usedFilterKeys,
  type BrowseFilters,
} from "@/lib/browse";
import { getAgencyCount, getIndexableCombos } from "@/lib/data/agencies";
import { getBrowseOptions, getBrowsePool, searchAgencyIds } from "@/lib/data/browse";
import { pricingName } from "@/lib/directory";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

// /agencies: every published agency, searchable and filterable. Everything lives in the URL and
// is rendered here on the server, so it works without JavaScript and links can be shared; the
// client part (BrowseSync) only rewrites the URL without a reload. The data is cached for a
// minute (lib/data/browse.ts). Indexing: docs/SEO.md and browseRobots (lib/browse.ts).

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Agencies", path: "/agencies" },
];

const count = new Intl.NumberFormat("en-US");
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const legend = "mb-2.5 text-[14px] font-semibold";
const field = cn(
  "h-11 w-full rounded-xl border border-line bg-raised px-3 text-[15px] text-text",
  focusRing,
);
const SHOWN_SERVICES = 6;

export async function generateMetadata({ searchParams }: PageProps<"/agencies">) {
  const robots = browseRobots(await searchParams);
  const n = await getAgencyCount();
  return buildMetadata({
    title: browseTitle(new Date().getFullYear(), robots.page, BRAND_NAME),
    description: browseDescription(n),
    path: robots.canonical,
    noindex: robots.noindex,
  });
}

export default async function AgenciesPage({ searchParams }: PageProps<"/agencies">) {
  const params = await searchParams;
  const pool = await getBrowsePool();
  const [{ options, services, industries, countries }, combos] = await Promise.all([
    getBrowseOptions(pool),
    getIndexableCombos(),
  ]);
  const f = parseBrowse(params, options);
  const searchIds = f.q ? new Set(await searchAgencyIds(f.q)) : null;
  const result = browse(pool, f, searchIds);
  const filtered = isFiltered(f);
  const href = (next: Partial<BrowseFilters>) =>
    `/agencies${browseQuery({ ...f, page: 1, ...next })}`;

  const serviceName = new Map(services.map((s) => [s.slug, s.name]));
  const industryName = new Map(industries.map((i) => [i.slug, i.name]));
  const countryName = new Map(countries.map((c) => [c.slug, c.name]));
  const budgetLabel = BROWSE_BUDGETS.find((b) => b.value === f.budget)?.label;

  const chips = [
    ...(f.q ? [{ label: `“${f.q}”`, to: href({ q: "" }) }] : []),
    ...(f.verified ? [{ label: "Verified only", to: href({ verified: false }) }] : []),
    ...f.services.map((s) => ({
      label: serviceName.get(s) ?? s,
      to: href({ services: f.services.filter((x) => x !== s) }),
    })),
    ...(f.industry
      ? [{ label: industryName.get(f.industry) ?? f.industry, to: href({ industry: null }) }]
      : []),
    ...(f.country
      ? [{ label: countryName.get(f.country) ?? f.country, to: href({ country: null }) }]
      : []),
    ...(budgetLabel ? [{ label: `Budget ${budgetLabel}`, to: href({ budget: null }) }] : []),
    ...f.pricing.map((p) => ({
      label: pricingName(p) ?? p,
      to: href({ pricing: f.pricing.filter((x) => x !== p) }),
    })),
    ...(f.team ? [{ label: `${f.team} people`, to: href({ team: null }) }] : []),
  ];

  // One service and one industry: the indexable service × industry page, when there is one.
  const combo =
    f.services.length === 1 && f.industry
      ? combos.find((c) => c.serviceSlug === f.services[0] && c.segment === `for-${f.industry}`)
      : undefined;
  const proposals = `/request-proposals?${new URLSearchParams({
    ...(f.services.length === 1 ? { service: f.services[0] } : {}),
    ...(f.industry ? { industry: f.industry } : {}),
    ref: "agencies",
  })}`;
  const total = pool.length;
  const extraServiceChecked = services
    .slice(SHOWN_SERVICES)
    .some((s) => f.services.includes(s.slug));

  const serviceBox = (s: { slug: string; name: string }) => (
    <label key={s.slug} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[15px]">
      <input
        type="checkbox"
        name="service"
        value={s.slug}
        form={BROWSE_FORM}
        defaultChecked={f.services.includes(s.slug)}
        className="size-4 accent-(--accent)"
      />
      {s.name}
    </label>
  );

  const filters = (
    <div className="flex flex-col gap-6">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl bg-(--mint-soft) px-4 py-2.5 font-semibold text-(--mint)">
        <span className="flex items-center gap-2">
          <BadgeCheck className="size-5" aria-hidden />
          Verified only
        </span>
        <input
          type="checkbox"
          role="switch"
          name="verified"
          value="1"
          form={BROWSE_FORM}
          defaultChecked={f.verified}
          className="size-5 accent-(--mint)"
        />
      </label>

      <fieldset>
        <legend className={legend}>Service</legend>
        <div className="flex flex-col">{services.slice(0, SHOWN_SERVICES).map(serviceBox)}</div>
        {services.length > SHOWN_SERVICES && (
          <details open={extraServiceChecked} className="group">
            <summary
              className={cn(
                "mt-1 flex min-h-9 cursor-pointer list-none items-center gap-1 rounded font-medium text-accent [&::-webkit-details-marker]:hidden",
                focusRing,
              )}
            >
              <span className="group-open:hidden">Show all</span>
              <span className="hidden group-open:inline">Show fewer</span>
              <ChevronDown className="size-4 group-open:rotate-180" aria-hidden />
            </summary>
            <div className="flex flex-col">{services.slice(SHOWN_SERVICES).map(serviceBox)}</div>
          </details>
        )}
      </fieldset>

      <div>
        <label htmlFor="browse-industry" className={cn(legend, "block")}>
          Industry or niche
        </label>
        <select
          id="browse-industry"
          name="industry"
          form={BROWSE_FORM}
          defaultValue={f.industry ?? ""}
          className={field}
        >
          <option value="">Any industry</option>
          {industries.map((i) => (
            <option key={i.slug} value={i.slug}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="browse-country" className={cn(legend, "block")}>
          Location
        </label>
        <select
          id="browse-country"
          name="country"
          form={BROWSE_FORM}
          defaultValue={f.country ?? ""}
          className={field}
        >
          <option value="">Any country</option>
          {countries.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={legend}>Your budget</legend>
        {/* Submit buttons so it works without JS; the hidden field keeps the current choice. */}
        <input type="hidden" name="budget" value={f.budget ?? ""} form={BROWSE_FORM} />
        <div className="flex flex-wrap gap-2">
          {[{ value: "", label: "Any" }, ...BROWSE_BUDGETS].map((b) => {
            const on = (f.budget ?? "") === b.value;
            return (
              <button
                key={b.label}
                type="submit"
                name="budget"
                value={b.value}
                form={BROWSE_FORM}
                aria-pressed={on}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full border px-3.5 text-[14px] font-medium",
                  on
                    ? "border-accent bg-accent-soft text-(--accent-on-soft)"
                    : "border-line bg-raised hover:border-text-2",
                  focusRing,
                )}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {options.pricing.length > 0 && (
        <fieldset>
          <legend className={legend}>Pricing model</legend>
          <div className="flex flex-col">
            {options.pricing.map((p) => (
              <label
                key={p}
                className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[15px]"
              >
                <input
                  type="checkbox"
                  name="pricing"
                  value={p}
                  form={BROWSE_FORM}
                  defaultChecked={f.pricing.includes(p)}
                  className="size-4 accent-(--accent)"
                />
                {pricingName(p) ?? p}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {options.teams.length > 0 && (
        <div>
          <label htmlFor="browse-team" className={cn(legend, "block")}>
            Team size
          </label>
          <select
            id="browse-team"
            name="team"
            form={BROWSE_FORM}
            defaultValue={f.team ?? ""}
            className={field}
          >
            <option value="">Any size</option>
            {options.teams.map((t) => (
              <option key={t} value={t}>
                {t} people
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Without JavaScript, changes apply with this button. */}
      <noscript>
        <button
          type="submit"
          form={BROWSE_FORM}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-accent font-semibold text-on-accent"
        >
          Apply filters
        </button>
      </noscript>
      <Link
        href="/agencies"
        rel="nofollow"
        className={cn("self-start rounded font-medium text-accent hover:underline", focusRing)}
      >
        Clear all
      </Link>
    </div>
  );

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={itemListJsonLd(result.items.map((a) => `/agency/${a.slug}`))} />
      <BrowseSync filterKeys={usedFilterKeys(f).join(",")} total={result.total} />
      {/* The one form: every field below points at it (form="browse"). A plain GET without JS. */}
      <form id={BROWSE_FORM} action="/agencies" method="get" />

      {/* 1. Header band */}
      <section className="border-b border-line bg-surface px-4 pt-8 pb-10 md:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
          <Breadcrumbs items={crumbs} />
          <div className="flex flex-col gap-2">
            <h1 className="text-[clamp(36px,5vw,56px)] leading-[1.04] font-[680] tracking-[-0.04em]">
              YouTube agencies
            </h1>
            <p className="text-[clamp(17px,1.6vw,19px)] text-text-2">
              Compare {count.format(total)} agencies by service, niche, location and budget.
            </p>
          </div>
          <div role="search" className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="browse-q" className="sr-only">
              Search agencies
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[18px] border border-line bg-raised px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
              <Search className="size-5 shrink-0 text-text-2" aria-hidden />
              <input
                id="browse-q"
                type="search"
                name="q"
                form={BROWSE_FORM}
                defaultValue={f.q}
                maxLength={100}
                placeholder="Search by agency name, service or niche…"
                className="h-14 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-text-2"
              />
            </div>
            <button
              type="submit"
              form={BROWSE_FORM}
              className={cn(
                "inline-flex h-14 items-center justify-center rounded-[18px] bg-accent px-7 text-[16px] font-semibold text-on-accent hover:bg-(--accent-hover)",
                focusRing,
              )}
            >
              Search
            </button>
          </div>
        </div>
      </section>

      {/* 2. Filters + results */}
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-8 md:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
        <aside
          aria-label="Filters"
          className="flex flex-col gap-4 lg:sticky lg:top-[76px] lg:self-start"
        >
          <FilterSheet count={filterCount(f)} total={result.total}>
            {filters}
          </FilterSheet>
        </aside>

        <section aria-labelledby="results-heading" className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="results-heading" className="text-h3">
                <span aria-live="polite">
                  {count.format(result.total)} {result.total === 1 ? "agency" : "agencies"}
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <label htmlFor="browse-sort" className="text-[14px] text-text-2">
                  Sort
                </label>
                <select
                  id="browse-sort"
                  name="sort"
                  form={BROWSE_FORM}
                  defaultValue={f.sort}
                  className={cn(field, "h-10 w-auto")}
                >
                  {BROWSE_SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {chips.length > 0 && (
              <ul aria-label="Active filters" className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <li key={c.label}>
                    <Link
                      href={c.to}
                      rel="nofollow"
                      scroll={false}
                      className={cn(
                        "inline-flex min-h-9 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[14px] font-medium text-(--accent-on-soft) hover:underline",
                        focusRing,
                      )}
                    >
                      {c.label}
                      <X className="size-3.5" aria-hidden />
                      <span className="sr-only">(remove)</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {combo && (
              <Link
                href={`/${combo.serviceSlug}/${combo.segment}`}
                className={cn(
                  "self-start rounded font-medium text-accent hover:underline",
                  focusRing,
                )}
              >
                See the full guide to {serviceName.get(combo.serviceSlug)} agencies for{" "}
                {industryName.get(f.industry!)} →
              </Link>
            )}
          </div>

          {result.total === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-[22px] border border-line bg-raised p-8">
              <p className="text-h3">No agencies match these filters.</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <Link
                  href="/agencies"
                  rel="nofollow"
                  className={cn(
                    "inline-flex h-11 items-center rounded-full border border-line px-5 font-medium hover:border-text-2",
                    focusRing,
                  )}
                >
                  Clear filters
                </Link>
                <Link
                  href={proposals}
                  className={cn("rounded font-medium text-accent hover:underline", focusRing)}
                >
                  Request proposals
                </Link>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {result.items.map((a) => (
                <li key={a.id}>
                  <AgencyCard agency={a} highlight={f.services[0]} />
                </li>
              ))}
            </ul>
          )}

          {result.pages > 1 && (
            <nav aria-label="Pages" className="flex flex-wrap items-center gap-2">
              {pageNumbers(result.page, result.pages).map((n, i) =>
                n === "gap" ? (
                  <span key={`gap-${i}`} aria-hidden className="px-1 text-text-2">
                    …
                  </span>
                ) : (
                  <Link
                    key={n}
                    href={`/agencies${browseQuery({ ...f, page: n })}`}
                    rel={filtered ? "nofollow" : undefined}
                    aria-current={n === result.page ? "page" : undefined}
                    className={cn(
                      "grid size-11 place-items-center rounded-full border font-mono text-[15px]",
                      n === result.page
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line hover:border-text-2",
                      focusRing,
                    )}
                  >
                    {n}
                  </Link>
                ),
              )}
              {result.page < result.pages && (
                <Link
                  href={`/agencies${browseQuery({ ...f, page: result.page + 1 })}`}
                  rel={filtered ? "nofollow next" : "next"}
                  className={cn(
                    "inline-flex h-11 items-center gap-1.5 rounded-full border border-line px-5 font-medium hover:border-text-2",
                    focusRing,
                  )}
                >
                  Next
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </nav>
          )}

          {result.total > 0 && (
            <div className="flex flex-col gap-3 rounded-[22px] border-2 border-dashed border-line p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-[18px] font-[650]">Rather not compare them all?</p>
                <p className="text-text-2">
                  Tell us about your project and get proposals from agencies that fit.
                </p>
              </div>
              <Link
                href={proposals}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full bg-accent px-5 font-semibold text-on-accent hover:bg-(--accent-hover) sm:self-auto",
                  focusRing,
                )}
              >
                Request proposals
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
