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
import { alternativesDisclosure, bylineDate, longDateOf, shortTitle } from "@/lib/guide-template";
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
// Default template: a navy hero band above the grid, the cover at the top of the article column.

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
  excerpt?: string | null;
  coverAlt?: string | null;
  /** Alternatives: when competitor prices were checked (yyyy-mm-dd). */
  pricesCheckedOn?: string | null;
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
  related,
  relatedGuides,
  agencies = [],
  shareUrl,
  budgetRange,
  generatedCover = true,
  categories = [],
  directoryStats,
  template = "default",
}: {
  guide: ArticleGuide;
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
  /** Live directory counts for directory stats blocks (a server component). */
  directoryStats?: (service: string) => React.ReactNode;
  /** "alternatives": the Alternatives hero, disclosure and nofollow outside links. */
  template?: "default" | "alternatives";
}) {
  const categoryOf = (id?: string | null) =>
    (id ? categories.find((c) => c.id === id) : null) ?? null;
  const category = categoryOf(guide.categoryId);
  const groups = groupOutline(guideBlocks(guide.doc, guideImageAllowed).outline);
  const numbered = guide.numberedSections;

  const alternatives = template === "alternatives" && !!category;

  const takeaways = guide.keyTakeaways.length > 0 && (
    // A guide block: the body's element styles (.guide-content) leave it alone.
    <section
      aria-labelledby="key-takeaways"
      className="guide-block mb-10 rounded-2xl bg-surface p-6"
    >
      <h2 id="key-takeaways" className="mb-3 text-[19px] font-semibold">
        Key takeaways
      </h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-[17px] marker:text-text-2">
        {guide.keyTakeaways.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );

  return (
    <>
      {!alternatives && <GuideHero guide={guide} category={category} />}
      <div className="mx-auto grid max-w-content grid-cols-1 px-4 pt-8 pb-20 min-[1100px]:grid-cols-[200px_minmax(0,680px)_40px] min-[1100px]:justify-center min-[1100px]:gap-x-12 md:px-6 md:pt-12">
        {alternatives ? (
          <AlternativesHeader guide={guide} category={category} generatedCover={generatedCover} />
        ) : (
          <GuideCover
            slug={guide.slug}
            coverPath={guide.coverPath}
            title={generatedCover ? undefined : guide.title}
            sizes="(min-width: 720px) 680px, 100vw"
            priority
            className="max-w-reading min-[1100px]:col-start-2"
            alt={guide.coverAlt?.trim() || guide.title}
          />
        )}

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
          {alternatives && takeaways}

          <GuideBody
            doc={guide.doc}
            budgetRange={budgetRange}
            directoryStats={directoryStats}
            nofollowOutside={alternatives}
            afterLead={alternatives ? undefined : takeaways}
          />

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
    </>
  );
}

/**
 * The default hero: a full-width navy band with the breadcrumb (Guides › category), the H1 and the
 * byline. The excerpt stays out of it (it's for search results, cards and link previews); the
 * cover sits under the band, in the article column.
 */
function GuideHero({ guide, category }: { guide: ArticleGuide; category: CardCategory | null }) {
  const crumb = "flex min-h-11 items-center underline-offset-4 hover:text-white hover:underline";
  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-[860px] flex-col items-center gap-5 px-4 pt-6 pb-12 text-center md:px-6 md:pb-16">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center justify-center gap-x-2 text-[14px] text-white/80">
            <li>
              <Link href="/guides" className={crumb}>
                Guides
              </Link>
            </li>
            {category && (
              <li className="flex items-center gap-2">
                <span aria-hidden>›</span>
                <Link href={`/guides/category/${category.slug}`} className={crumb}>
                  {category.name}
                </Link>
              </li>
            )}
          </ol>
        </nav>
        <h1 className="text-display text-balance">{guide.title}</h1>
        <div className="mt-1 flex flex-col items-center gap-2 text-[15px] text-white/85">
          {guide.author && (
            <p className="flex items-center gap-3">
              <AuthorAvatar author={guide.author} size={36} />
              <span>
                Written by{" "}
                <Link
                  href={`/authors/${guide.author.slug}`}
                  className="font-semibold text-white underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {guide.author.name}
                </Link>
              </span>
            </p>
          )}
          <p>
            Last updated on <time dateTime={guide.updatedAt}>{bylineDate(guide.updatedAt)}</time>
          </p>
        </div>
      </div>
    </header>
  );
}

/**
 * The Alternatives hero: breadcrumb, category chip, H1, the excerpt as the subtitle and the cover
 * on the right (under it on small screens), the byline, and the disclosure, which this category
 * always shows.
 */
function AlternativesHeader({
  guide,
  category,
  generatedCover,
}: {
  guide: ArticleGuide;
  category: CardCategory;
  generatedCover: boolean;
}) {
  return (
    <header className="grid gap-8 min-[1100px]:col-span-3 md:grid-cols-[minmax(0,1fr)_minmax(0,400px)] md:items-center">
      <div className="flex min-w-0 flex-col gap-5">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 text-small">
            <li>
              <Link href="/guides" className="flex min-h-11 items-center hover:text-text">
                Guides
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>›</span>
              <Link href={`/guides/category/${category.slug}`} className="flex min-h-11 items-center hover:text-text">
                {category.name}
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>›</span>
              <span aria-current="page" className="text-text">
                {shortTitle(guide.title)}
              </span>
            </li>
          </ol>
        </nav>
        <Link
          href={`/guides/category/${category.slug}`}
          className="-mb-1 self-start rounded-full px-3 py-1 text-[13px] font-semibold tracking-[0.06em] text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ background: colorHex(category.color) }}
        >
          {category.name}
        </Link>
        <h1 className="text-display">{guide.title}</h1>
        {guide.excerpt && <p className="text-[19px] text-text-2">{guide.excerpt}</p>}
        <div className="flex flex-col gap-1.5 text-[15px] text-text-2">
          {guide.author && (
            <p className="flex items-center gap-2.5">
              <AuthorAvatar author={guide.author} size={32} />
              <span>
                Written by{" "}
                <Link href={`/authors/${guide.author.slug}`} className="font-medium text-text hover:underline">
                  {guide.author.name}
                </Link>
                {guide.author.role && <> · {guide.author.role}</>}
              </span>
            </p>
          )}
          <p>
            Updated <time dateTime={guide.updatedAt}>{dateText(guide.updatedAt)}</time> · {guide.readMinutes} min read
          </p>
        </div>
        <p className="rounded-xl bg-surface px-4 py-3 text-[14.5px] text-text-2">
          {alternativesDisclosure(guide.pricesCheckedOn ? longDateOf(guide.pricesCheckedOn) : "[date]")}
        </p>
      </div>
      <GuideCover
        slug={guide.slug}
        coverPath={guide.coverPath}
        title={generatedCover ? undefined : guide.title}
        sizes="(min-width: 768px) 400px, 100vw"
        priority
        alt={guide.coverAlt ?? ""}
      />
    </header>
  );
}
