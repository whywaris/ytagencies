import { CalendarDays, ChevronDown, Scale, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { Results, ResultsView } from "@/components/directory/results";
import { JsonLd } from "@/components/json-ld";
import { PageTracker } from "@/components/page-tracker";
import type { AgencyListItem } from "@/lib/data/agencies";
import type { Faq } from "@/lib/data/taxonomy";
import { atAGlance } from "@/lib/directory";
import { breadcrumbJsonLd, faqJsonLd, itemListJsonLd } from "@/lib/seo/json-ld";

type LinkGroup = { title: string; links: { href: string; label: string }[] };

type DirectoryPageProps = {
  heading: string;
  /** One line under the H1. */
  summary: string;
  /** "October 2026": newest change to the page copy or a listed agency. */
  updated: string | null;
  breadcrumbs: Crumb[]; // from Home to this page
  agencies: AgencyListItem[];
  emptyHint: React.ReactNode;
  /** This page's service slug, highlighted on the cards. */
  highlight: string;
  /** Request proposals, prefilled with this page's service (and industry). */
  matchHref: string;
  /** H2 over the long intro, e.g. "YouTube Ads for Doctors brands". */
  aboutHeading: string;
  /** The long intro, already in short paragraphs. */
  about: string[];
  howToChoose: string[];
  faqs: Faq[];
  related: LinkGroup[];
};

const icon = "size-4 shrink-0 text-text-2 [stroke-width:1.5]";
const card = "flex flex-col gap-3 rounded-lg border border-line p-5";

export function DirectoryPage({
  heading,
  summary,
  updated,
  breadcrumbs,
  agencies,
  emptyHint,
  highlight,
  matchHref,
  aboutHeading,
  about,
  howToChoose,
  faqs,
  related,
}: DirectoryPageProps) {
  const groups = related.filter((g) => g.links.length > 0);
  const glance = atAGlance(agencies);
  const n = agencies.length;

  return (
    <>
      <PageTracker />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <JsonLd data={itemListJsonLd(agencies.map((a) => `/agency/${a.slug}`))} />
      {/* Same text as the visible answers below. */}
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}

      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-10 md:px-6 md:py-14">
          <Breadcrumbs items={breadcrumbs} />
          <h1 className="text-h1">{heading}</h1>
          {summary && <p className="max-w-reading text-text-2">{summary}</p>}
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-small">
            {n > 0 && (
              <li className="flex items-center gap-1.5">
                <Users className={icon} aria-hidden />
                {n} {n === 1 ? "agency" : "agencies"}
              </li>
            )}
            {updated && (
              <li className="flex items-center gap-1.5">
                <CalendarDays className={icon} aria-hidden />
                Updated {updated}
              </li>
            )}
            <li>
              <Link href="/how-we-rank" className="flex items-center gap-1.5 hover:text-text">
                <Scale className={icon} aria-hidden />
                <span className="underline underline-offset-2">How we rank agencies</span>
              </Link>
            </li>
          </ul>
        </div>
      </header>

      <div className="mx-auto flex max-w-content flex-col gap-20 px-4 py-10 md:px-6 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8">
          <section aria-label="Agencies" className="flex min-w-0 flex-col gap-8">
            <Suspense
              fallback={
                <ResultsView agencies={agencies} emptyHint={emptyHint} highlight={highlight} />
              }
            >
              <Results agencies={agencies} emptyHint={emptyHint} highlight={highlight} />
            </Suspense>
            {n > 0 && (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Not sure which one fits?</p>
                  <p className="text-text-2">
                    Tell us about your project and we&apos;ll pass it to up to 3 agencies that fit.
                  </p>
                </div>
                <Link
                  href={matchHref}
                  className="inline-flex h-11 shrink-0 items-center rounded-full border border-line px-5 font-medium hover:border-text-2"
                >
                  Request proposals
                </Link>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-[76px] lg:self-start">
            <div className={card}>
              <Sparkles className="size-5 [stroke-width:1.5] text-accent" aria-hidden />
              <h2 className="text-h3">Request proposals in one step</h2>
              <p className="text-text-2">
                Describe your project once; up to 3 agencies that fit get it and can reply to you.
              </p>
              <Link
                href={matchHref}
                className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 font-medium text-on-accent hover:bg-(--accent-hover)"
              >
                Request proposals, free
              </Link>
              <p className="text-small">No signup. Interested agencies reply by email.</p>
            </div>
            {glance.length > 0 && (
              <div className={card}>
                <h2 className="text-h3">At a glance</h2>
                <dl className="flex flex-col">
                  {glance.map((r) => (
                    <div
                      key={r.label}
                      className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0"
                    >
                      <dt className="text-text-2">{r.label}</dt>
                      <dd className="font-medium num">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </aside>
        </div>

        {about.length > 0 && (
          <section aria-labelledby="about" className="flex max-w-[760px] flex-col gap-4">
            <h2 id="about" className="text-h2">
              {aboutHeading}
            </h2>
            {about.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        )}

        {howToChoose.length > 0 && (
          <section aria-labelledby="how-to-choose" className="flex flex-col gap-6">
            <h2 id="how-to-choose" className="text-h2">
              How to choose
            </h2>
            <ol className="grid gap-4 md:grid-cols-3">
              {howToChoose.map((p, i) => (
                <li key={i} className={card}>
                  <span
                    aria-hidden
                    className="grid size-8 place-items-center rounded-full bg-accent-soft text-[15px] font-semibold text-(--accent-on-soft)"
                  >
                    {i + 1}
                  </span>
                  <p>{p}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {faqs.length > 0 && (
          <section aria-labelledby="faqs" className="flex max-w-[760px] flex-col gap-4">
            <h2 id="faqs" className="text-h2">
              Questions
            </h2>
            <div className="flex flex-col border-t border-line">
              {faqs.map((f, i) => (
                <details key={f.question} open={i === 0} className="group border-b border-line">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                    {f.question}
                    <ChevronDown
                      className="size-5 shrink-0 [stroke-width:1.5] text-text-2 transition-transform duration-150 group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="pb-4 text-text-2">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {groups.length > 0 && (
          <section
            aria-labelledby="related"
            className="grid gap-8 border-t border-line pt-12 md:grid-cols-3"
          >
            <h2 id="related" className="sr-only">
              Related pages
            </h2>
            {groups.map((g) => (
              <div key={g.title} className="flex flex-col gap-3">
                <h3 className="text-h3">{g.title}</h3>
                <ul className="flex flex-wrap gap-2">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-[15px] hover:border-text-2"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
