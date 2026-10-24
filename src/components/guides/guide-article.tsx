import Link from "next/link";

import { AgencyCard } from "@/components/directory/agency-card";
import { GuideBody } from "@/components/guide-body";
import {
  AuthorAvatar,
  AuthorBox,
  GuideCard,
  GuideCover,
  type CardCategory,
} from "@/components/guides/guide-parts";
import { colorHex } from "@/lib/guide-categories";
import { ShareBar } from "@/components/guides/share-bar";
import { TableOfContents } from "@/components/guides/toc";
import { TocPanel } from "@/components/toc-panel";
import { Button } from "@/components/ui/button";
import type { AgencyListItem } from "@/lib/data/agencies";
import type { Author, GuideSummary } from "@/lib/data/guides";
import { groupOutline, guideBlocks, type Doc } from "@/lib/guide-content";
import { guideImageAllowed } from "@/lib/guide-media";
import { cn } from "@/lib/utils";

// The guide page layout, shared by /guides/[slug] and the admin "Preview as page".
// ≥ 1100px: table of contents | article (≤ 680px) | share rail, the side columns sticky.
// Smaller: a collapsible "On this page" under the hero and share links after the article.

export type ArticleGuide = {
  slug: string;
  title: string;
  doc: Doc;
  coverPath: string | null;
  updatedAt: string;
  readMinutes: number;
  author: Author | null;
  keyTakeaways: string[];
  numberedSections: boolean;
  categoryId?: string | null;
};

const dateText = (d: string) =>
  new Date(d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export function GuideArticle({
  guide,
  primaryService,
  related,
  relatedGuides,
  agencies = [],
  shareUrl,
  budgetRange,
  generatedCover = true,
  categories = [],
}: {
  guide: ArticleGuide;
  /** First related directory page's service: the second breadcrumb step. */
  primaryService: { name: string; slug: string } | null;
  related: { href: string; label: string }[];
  relatedGuides: GuideSummary[];
  /** "Agencies mentioned": live profiles the guide links to (the public page only). */
  agencies?: AgencyListItem[];
  shareUrl: string;
  budgetRange: (service: string) => React.ReactNode;
  /** false: draw the no-cover fallback in HTML instead of loading the generated image. */
  generatedCover?: boolean;
  /** Guide categories: the chip above the H1 and the "More guides" covers. */
  categories?: (CardCategory & { id: string })[];
}) {
  const categoryOf = (id?: string | null) => (id ? categories.find((c) => c.id === id) : null) ?? null;
  const category = categoryOf(guide.categoryId);
  const groups = groupOutline(guideBlocks(guide.doc, guideImageAllowed).outline);
  const numbered = guide.numberedSections;

  return (
    <div className="mx-auto grid max-w-content grid-cols-1 px-4 pt-8 pb-20 min-[1100px]:grid-cols-[200px_minmax(0,680px)_40px] min-[1100px]:justify-center min-[1100px]:gap-x-12 md:px-6 md:pt-12">
      <header className="flex max-w-reading flex-col gap-6 min-[1100px]:col-start-2">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 text-small">
            <li>
              <Link href="/guides" className="flex min-h-11 items-center hover:text-text">
                Guides
              </Link>
            </li>
            {primaryService && (
              <li className="flex items-center gap-2">
                <span aria-hidden>/</span>
                <Link
                  href={`/${primaryService.slug}`}
                  className="flex min-h-11 items-center hover:text-text"
                >
                  {primaryService.name}
                </Link>
              </li>
            )}
          </ol>
        </nav>
        {category && (
          <Link
            href={`/guides/category/${category.slug}`}
            className="-mb-2 self-start rounded-full px-3 py-1 text-[13px] font-semibold tracking-[0.06em] text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{ background: colorHex(category.color) }}
          >
            {category.name}
          </Link>
        )}
        <h1 className="text-display">{guide.title}</h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-text-2">
          {guide.author && (
            <Link
              href={`/authors/${guide.author.slug}`}
              className="flex items-center gap-2.5 font-medium text-text hover:underline"
            >
              <AuthorAvatar author={guide.author} size={32} />
              {guide.author.name}
            </Link>
          )}
          <span>
            Updated <time dateTime={guide.updatedAt}>{dateText(guide.updatedAt)}</time>
          </span>
          <span>{guide.readMinutes} min read</span>
        </div>
        <GuideCover
          slug={guide.slug}
          coverPath={guide.coverPath}
          title={generatedCover ? undefined : guide.title}
          sizes="(min-width: 720px) 680px, 100vw"
          priority
          className="mt-2"
        />
      </header>

      {groups.length > 0 && (
        <>
          <aside className="hidden min-[1100px]:col-start-1 min-[1100px]:row-start-2 min-[1100px]:block print:hidden">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pt-12">
              <TableOfContents groups={groups} numbered={numbered} />
            </div>
          </aside>
          <TocPanel groups={groups} numbered={numbered} className="mt-8" />
        </>
      )}

      <article
        className={cn(
          "max-w-reading min-w-0 pt-10 text-[18px] leading-[1.65] min-[1100px]:col-start-2 min-[1100px]:row-start-2",
          numbered && "guide-numbered",
        )}
      >
        {guide.keyTakeaways.length > 0 && (
          <section aria-labelledby="key-takeaways" className="mb-10 rounded-2xl bg-surface p-6">
            <h2 id="key-takeaways" className="mb-3 text-[19px] font-semibold">
              Key takeaways
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[17px] marker:text-text-2">
              {guide.keyTakeaways.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        <GuideBody doc={guide.doc} budgetRange={budgetRange} />

        {agencies.length > 0 && (
          <section aria-labelledby="agencies-mentioned" className="mt-16 flex flex-col gap-4">
            <h2 id="agencies-mentioned" className="text-h3">
              Agencies mentioned
            </h2>
            <ul className="flex flex-col gap-4">
              {agencies.map((a) => (
                <li key={a.id}>
                  <AgencyCard agency={a} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {related.length > 0 && (
          <section
            aria-labelledby="find-agency"
            className="mt-16 flex flex-col gap-4 rounded-2xl bg-surface p-6 md:p-8"
          >
            <h2 id="find-agency" className="text-h3">
              Find the right agency
            </h2>
            <p className="text-[17px] text-text-2">
              Compare agencies that do this work, with their budgets, specialties and reviews.
            </p>
            <Button asChild className="self-start">
              <Link href={related[0].href}>{related[0].label}</Link>
            </Button>
            {related.length > 1 && (
              <ul className="flex flex-col text-[17px]">
                {related.slice(1).map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      className="flex min-h-11 items-center text-accent hover:underline"
                    >
                      {r.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <ShareBar
          url={shareUrl}
          title={guide.title}
          variant="row"
          className="mt-12 min-[1100px]:hidden"
        />

        {guide.author && (
          <div className="mt-12">
            <AuthorBox author={guide.author} />
          </div>
        )}
      </article>

      <aside className="hidden min-[1100px]:col-start-3 min-[1100px]:row-start-2 min-[1100px]:block">
        <div className="sticky top-20 pt-12">
          <ShareBar url={shareUrl} title={guide.title} variant="rail" />
        </div>
      </aside>

      {relatedGuides.length > 0 && (
        <section
          aria-labelledby="more-guides"
          className="mt-20 flex flex-col gap-8 border-t border-line pt-12 min-[1100px]:col-span-3"
        >
          <h2 id="more-guides" className="text-h2">
            More guides
          </h2>
          <div className="grid gap-x-8 gap-y-10 min-[1100px]:grid-cols-3 sm:grid-cols-2">
            {relatedGuides.map((g) => (
              <GuideCard key={g.slug} guide={g} category={categoryOf(g.categoryId)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
