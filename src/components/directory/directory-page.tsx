import Link from "next/link";
import { Suspense } from "react";

import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { Results, ResultsView } from "@/components/directory/results";
import { JsonLd } from "@/components/json-ld";
import { PageTracker } from "@/components/page-tracker";
import type { AgencyListItem } from "@/lib/data/agencies";
import type { Faq } from "@/lib/data/taxonomy";
import { breadcrumbJsonLd, faqJsonLd, itemListJsonLd } from "@/lib/seo/json-ld";

type LinkGroup = { title: string; links: { href: string; label: string }[] };

type DirectoryPageProps = {
  heading: string;
  intro: string[];
  breadcrumbs: Crumb[]; // from Home to this page
  agencies: AgencyListItem[];
  emptyHint: React.ReactNode;
  howToChoose: string[];
  faqs: Faq[];
  related: LinkGroup[];
};

export function DirectoryPage({
  heading,
  intro,
  breadcrumbs,
  agencies,
  emptyHint,
  howToChoose,
  faqs,
  related,
}: DirectoryPageProps) {
  const groups = related.filter((g) => g.links.length > 0);
  return (
    <>
      <PageTracker />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <JsonLd data={itemListJsonLd(agencies.map((a) => `/agency/${a.slug}`))} />
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}

      <div className="mx-auto flex max-w-content flex-col gap-20 px-4 py-12 md:px-6 md:py-20">
        <header className="flex flex-col gap-6">
          <Breadcrumbs items={breadcrumbs} />
          <h1 className="text-h1">{heading}</h1>
          <div className="flex max-w-reading flex-col gap-4">
            {intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </header>

        <section aria-label="Agencies">
          <Suspense fallback={<ResultsView agencies={agencies} emptyHint={emptyHint} />}>
            <Results agencies={agencies} emptyHint={emptyHint} />
          </Suspense>
        </section>

        <section aria-labelledby="how-to-choose" className="flex max-w-reading flex-col gap-4">
          <h2 id="how-to-choose" className="text-h2">
            How to choose
          </h2>
          {howToChoose.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>

        {faqs.length > 0 && (
          <section aria-labelledby="faqs" className="flex max-w-reading flex-col gap-6">
            <h2 id="faqs" className="text-h2">
              Questions
            </h2>
            <dl className="flex flex-col gap-6">
              {faqs.map((f) => (
                <div key={f.question} className="flex flex-col gap-2">
                  <dt className="text-h3">{f.question}</dt>
                  <dd className="text-text-2">{f.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {groups.length > 0 && (
          <section
            aria-labelledby="related"
            className="flex flex-col gap-8 border-t border-line pt-12"
          >
            <h2 id="related" className="sr-only">
              Related pages
            </h2>
            {groups.map((g) => (
              <div key={g.title} className="flex flex-col gap-3">
                <h3 className="text-h3">{g.title}</h3>
                <ul className="flex flex-wrap gap-x-6">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="flex min-h-11 items-center text-accent hover:underline"
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
