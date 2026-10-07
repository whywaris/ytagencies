import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { GuideBody } from "@/components/guide-body";
import { AuthorAvatar, AuthorBox, GuideCard, GuideCover } from "@/components/guides/guide-parts";
import { ShareBar } from "@/components/guides/share-bar";
import { TableOfContents } from "@/components/guides/toc";
import { Button } from "@/components/ui/button";
import type { Author, GuideSummary } from "@/lib/data/guides";
import { groupOutline, parseGuideWithOutline } from "@/lib/markdown";
import { cn } from "@/lib/utils";

// The guide page layout, shared by /guides/[slug] and the admin "Preview as page".
// ≥ 1100px: table of contents | article (≤ 680px) | share rail, the side columns sticky.
// Smaller: a collapsible "On this page" under the hero and share links after the article.

export type ArticleGuide = {
  slug: string;
  title: string;
  body: string;
  coverPath: string | null;
  updatedAt: string;
  readMinutes: number;
  author: Author | null;
  keyTakeaways: string[];
  numberedSections: boolean;
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
  shareUrl,
  budgetRange,
  generatedCover = true,
}: {
  guide: ArticleGuide;
  /** First related directory page's service: the second breadcrumb step. */
  primaryService: { name: string; slug: string } | null;
  related: { href: string; label: string }[];
  relatedGuides: GuideSummary[];
  shareUrl: string;
  budgetRange: (service: string) => React.ReactNode;
  /** false: draw the no-cover fallback in HTML instead of loading the generated image. */
  generatedCover?: boolean;
}) {
  const groups = groupOutline(parseGuideWithOutline(guide.body).outline);
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
          <aside className="hidden min-[1100px]:col-start-1 min-[1100px]:row-start-2 min-[1100px]:block">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pt-12">
              <TableOfContents groups={groups} numbered={numbered} />
            </div>
          </aside>
          <details className="group mt-8 max-w-reading rounded-2xl border border-line min-[1100px]:hidden">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between px-5 font-semibold [&::-webkit-details-marker]:hidden">
              On this page
              <ChevronDown
                aria-hidden
                className="size-5 [stroke-width:1.75] text-text-2 transition-transform duration-150 group-open:rotate-180"
              />
            </summary>
            <ol className="flex flex-col gap-1 px-5 pb-4 text-[15px]">
              {groups.map((g, i) => (
                <li key={g.id}>
                  <a
                    href={`#${g.id}`}
                    className="flex min-h-10 items-center text-text-2 hover:text-text"
                  >
                    {numbered && <span className="mr-1.5 tabular-nums">{i + 1}.</span>}
                    {g.text}
                  </a>
                </li>
              ))}
            </ol>
          </details>
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

        <GuideBody md={guide.body} budgetRange={budgetRange} />

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
              <GuideCard key={g.slug} guide={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
