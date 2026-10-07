import { Breadcrumbs } from "@/components/breadcrumbs";
import { CopyLinkButton } from "@/components/guides/copy-link";
import { TableOfContents } from "@/components/guides/toc";
import { JsonLd } from "@/components/json-ld";
import { TocPanel } from "@/components/toc-panel";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seo/json-ld";

// Shared template for the legal and policy pages (/privacy, /terms, /refunds, /cookies,
// /disclosure, /editorial-policy): "In short" summary, numbered sections with anchor links, a
// sticky table of contents on wide screens and a collapsible one below 1100px. Print-friendly.

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/** "2026-10-07" → "October 7, 2026" (UTC, so the date never shifts by time zone). */
export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** Text links inside legal copy. */
export const prose =
  "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul:last-child]:mb-0 [&_li]:marker:text-text-2 [&_strong]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:font-semibold";

export function LegalPage({
  title,
  description,
  path,
  updated,
  summary,
  sections,
  contactEmail,
  children,
}: {
  title: string;
  /** Same as the meta description; used in the WebPage JSON-LD. */
  description: string;
  path: string;
  /** yyyy-mm-dd: change it whenever the page's substance changes. */
  updated: string;
  /** "In short": 3–5 plain sentences. */
  summary: string[];
  sections: LegalSection[];
  /** For the closing "Questions?" line. */
  contactEmail: string;
  /** Optional note between the summary and the sections (e.g. "plans aren't on sale yet"). */
  children?: React.ReactNode;
}) {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: title, path },
  ];
  const groups = sections.map((s) => ({ id: s.id, text: s.title, children: [] }));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={webPageJsonLd({ name: title, description, path, updated })} />
      <div className="mx-auto grid max-w-content grid-cols-1 px-4 pt-8 pb-20 min-[1100px]:grid-cols-[200px_minmax(0,680px)] min-[1100px]:justify-center min-[1100px]:gap-x-12 md:px-6 md:pt-12">
        <header className="flex max-w-reading flex-col gap-6 min-[1100px]:col-start-2">
          <div className="print:hidden">
            <Breadcrumbs items={crumbs} />
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="text-h1">{title}</h1>
            <p className="text-small">
              Last updated <time dateTime={updated}>{longDate(updated)}</time>
            </p>
          </div>
          <section
            aria-labelledby="in-short"
            className="rounded-2xl bg-surface p-6 print:border print:border-line"
          >
            <h2 id="in-short" className="mb-3 text-[17px] font-semibold">
              In short
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[17px] marker:text-text-2">
              {summary.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
          {children}
          <TocPanel groups={groups} numbered />
        </header>

        <aside className="hidden min-[1100px]:col-start-1 min-[1100px]:row-start-2 min-[1100px]:block print:hidden">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pt-12">
            <TableOfContents groups={groups} numbered />
          </div>
        </aside>

        <div className="max-w-reading min-w-0 text-[17px] leading-[1.6] min-[1100px]:col-start-2 min-[1100px]:row-start-2">
          {sections.map((s, i) => (
            <section key={s.id} aria-labelledby={s.id} className="break-inside-avoid-page">
              <h2 id={s.id} className="group mt-14 mb-4 scroll-mt-20 text-h3 md:text-[24px]">
                <span className="mr-2 text-text-2 tabular-nums">{i + 1}.</span>
                {s.title}
                <CopyLinkButton
                  hash={s.id}
                  label={`Copy link to "${s.title}"`}
                  className="ml-2 inline-flex size-8 translate-y-[-0.1em] items-center justify-center rounded-full align-middle text-text-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-text focus-visible:opacity-100 print:hidden"
                />
              </h2>
              <div className={prose}>{s.body}</div>
            </section>
          ))}
          <p className="mt-16 border-t border-line pt-6 text-[16px] text-text-2">
            Questions?{" "}
            <a href={`mailto:${contactEmail}`} className="text-accent underline underline-offset-2">
              Contact {contactEmail}
            </a>
            .
          </p>
        </div>
      </div>
    </>
  );
}
