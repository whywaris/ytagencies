import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  AuthorAvatar,
  CategoryCover,
  GuideCard,
  GuideCover,
  type CardCategory,
} from "@/components/guides/guide-parts";
import { GuideSearch } from "@/components/guides/guide-search";
import { JsonLd } from "@/components/json-ld";
import { pageNumbers } from "@/lib/browse";
import {
  getGuideCategories,
  getLiveGuides,
  searchLiveGuides,
  type GuideCategory,
  type GuideSummary,
} from "@/lib/data/guides";
import { getGuideTabsMax } from "@/lib/data/settings";
import {
  categoryIndexable,
  cleanGuideQuery,
  GUIDES_PER_PAGE,
  guideTabs,
  pickFeatured,
} from "@/lib/guide-categories";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/seo/json-ld";
import { cn } from "@/lib/utils";

// /guides and /guides/category/[slug]: header with search, category tabs (real links, "More" as a
// <details> so it works without JavaScript), the featured guide (All, no search), a paginated grid
// and the closing band.

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** Everything both routes need, for the page and its metadata. `category` is a slug or null. */
export async function guidesView(category: string | null, sp: Params) {
  const [guides, categories, max] = await Promise.all([
    getLiveGuides(),
    getGuideCategories(),
    getGuideTabsMax(),
  ]);
  const live = new Map<string, number>();
  for (const g of guides) if (g.categoryId) live.set(g.categoryId, (live.get(g.categoryId) ?? 0) + 1);
  const liveCount = (id: string) => live.get(id) ?? 0;
  const { tabs, more } = guideTabs(categories, liveCount, max);

  const current = category ? (categories.find((c) => c.slug === category) ?? null) : null;
  // Search lives on /guides only; the box on a category page searches all guides.
  const q = category ? "" : cleanGuideQuery(one(sp.q));
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);

  let list = current ? guides.filter((g) => g.categoryId === current.id) : guides;
  if (q) {
    const hits = await searchLiveGuides(q);
    list = list.filter((g) => hits.has(g.slug));
  }
  const featured = !category && !q ? pickFeatured(guides) : null;
  const rest = featured ? list.filter((g) => g.slug !== featured.slug) : list;
  const pages = Math.max(1, Math.ceil(rest.length / GUIDES_PER_PAGE));
  const shown = rest.slice((page - 1) * GUIDES_PER_PAGE, page * GUIDES_PER_PAGE);

  return {
    categories,
    tabs,
    more,
    current,
    q,
    page,
    pages,
    total: list.length,
    featured: page === 1 ? featured : null,
    shown,
    // A category page needs a live guide; an out-of-range page is a 404.
    missing: (!!category && (!current || liveCount(current.id) === 0)) || page > pages,
    indexable: current ? categoryIndexable(liveCount(current.id)) : !q,
  };
}

export type GuidesView = Awaited<ReturnType<typeof guidesView>>;

export const guidesPath = (category: string | null, page = 1, q = "") => {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (page > 1) p.set("page", String(page));
  const base = category ? `/guides/category/${category}` : "/guides";
  return p.size ? `${base}?${p}` : base;
};

const updated = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export function GuidesIndex({ view, description }: { view: GuidesView; description: string }) {
  const { categories, tabs, more, current, q, page, pages, total, featured, shown } = view;
  const byId = new Map<string, CardCategory>(categories.map((c) => [c.id, c]));
  const cat = (g: GuideSummary) => (g.categoryId ? (byId.get(g.categoryId) ?? null) : null);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    ...(current ? [{ name: current.name, path: guidesPath(current.slug) }] : []),
  ];
  const listed = [...(featured ? [featured] : []), ...shown];
  const heading = q ? "Search results" : current ? current.name : "Latest guides";

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={collectionPageJsonLd({
          path: guidesPath(current?.slug ?? null, page),
          name: current ? `${current.name} guides` : "Guides",
          description,
          items: listed.map((g) => ({ path: `/guides/${g.slug}`, name: g.title })),
        })}
      />
      <div className="mx-auto flex max-w-content flex-col gap-10 px-4 pt-10 pb-20 md:px-6 md:pt-16">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
          <div className="flex max-w-reading flex-col gap-4">
            {current && <Breadcrumbs items={crumbs} />}
            <p className="text-[13px] font-semibold tracking-[0.08em] text-text-2 uppercase">
              Guides
            </p>
            <h1 className="text-display">
              {current ? current.name : "Know what you're buying before you hire."}
            </h1>
            <p className="text-[19px] text-text-2">
              {current
                ? (current.description ?? `Guides on ${current.name.toLowerCase()}.`)
                : "Plain answers on YouTube agency prices, contracts and results, for businesses and creators."}
            </p>
          </div>
          <div className="w-full md:max-w-[360px]">
            <GuideSearch initial={q} />
          </div>
        </header>

        {tabs.length + more.length > 0 && (
          <Tabs tabs={tabs} more={more} current={current?.slug ?? null} />
        )}

        {featured && <Featured guide={featured} category={cat(featured)} />}

        <section aria-labelledby="guides-grid" className="flex flex-col gap-8">
          <h2 id="guides-grid" className="flex items-baseline gap-3 text-h2">
            {heading}
            <span className="text-[16px] font-normal text-text-2">
              {total} {total === 1 ? "guide" : "guides"}
            </span>
          </h2>
          {shown.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-x-8 gap-y-12">
              {shown.map((g) => (
                <GuideCard key={g.slug} guide={g} excerpt category={cat(g)} />
              ))}
            </div>
          ) : q ? (
            <p className="text-text-2">
              No guides match “{q}”.{" "}
              <Link href="/guides" className={cn("rounded text-accent hover:underline", focusRing)}>
                Show all guides
              </Link>
            </p>
          ) : (
            !featured && <p className="text-text-2">No guides here yet.</p>
          )}
        </section>

        {pages > 1 && (
          <nav aria-label="Pages" className="flex flex-wrap items-center gap-2">
            {pageNumbers(page, pages).map((n, i) =>
              n === "gap" ? (
                <span key={`gap-${i}`} aria-hidden className="px-1 text-text-2">
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={guidesPath(current?.slug ?? null, n, q)}
                  rel={q ? "nofollow" : undefined}
                  aria-current={n === page ? "page" : undefined}
                  className={cn(
                    "grid size-11 place-items-center rounded-full border font-mono text-[15px]",
                    n === page
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line hover:border-text-2",
                    focusRing,
                  )}
                >
                  {n}
                </Link>
              ),
            )}
          </nav>
        )}

        <section aria-labelledby="guides-closing">
          <div className="flex flex-col items-center gap-5 rounded-[28px] bg-[#16171a] px-6 py-14 text-center text-white md:py-16 site-dark:border site-dark:border-line site-dark:bg-raised">
            <h2 id="guides-closing" className="text-h2">
              Ready to compare agencies?
            </h2>
            <p className="text-[17px] text-white/75">
              See starting prices and the niches each agency works in.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Link
                href="/agencies"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-[#16171a] transition-transform duration-150 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Browse agencies
                <ArrowRight className="size-5 [stroke-width:2]" aria-hidden />
              </Link>
              <Link
                href="/request-proposals"
                className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 font-semibold text-white transition-colors duration-150 hover:border-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Request proposals
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

const tab = (active: boolean) =>
  cn(
    "flex h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] whitespace-nowrap transition-colors duration-150",
    active ? "border-text bg-text text-bg" : "border-line text-text-2 hover:border-text-2 hover:text-text",
    focusRing,
  );

function Tabs({
  tabs,
  more,
  current,
}: {
  tabs: GuideCategory[];
  more: GuideCategory[];
  current: string | null;
}) {
  const inMore = more.some((c) => c.slug === current);
  return (
    <nav aria-label="Guide categories" className="flex items-start gap-2">
      {/* Scrolls sideways on small screens; "More" sits outside so its menu isn't clipped. */}
      <ul className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {[{ slug: null, name: "All" }, ...tabs].map((c) => (
          <li key={c.slug ?? "all"} className="shrink-0">
            <Link
              href={guidesPath(c.slug)}
              aria-current={current === c.slug ? "page" : undefined}
              className={tab(current === c.slug)}
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
      {more.length > 0 && (
        <details className="group relative shrink-0">
          <summary className={cn(tab(inMore), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
            More
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="absolute right-0 z-20 mt-2 flex min-w-[220px] flex-col rounded-2xl border border-line bg-raised p-1.5 shadow-lg">
            {more.map((c) => (
              <li key={c.slug}>
                <Link
                  href={guidesPath(c.slug)}
                  aria-current={current === c.slug ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center rounded-xl px-3 text-[15px] hover:bg-surface",
                    current === c.slug && "font-semibold text-accent",
                    focusRing,
                  )}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </nav>
  );
}

function Featured({ guide, category }: { guide: GuideSummary; category: CardCategory | null }) {
  return (
    <article className="group relative grid items-center gap-6 rounded-[28px] border border-line bg-raised p-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-10 md:p-5">
      {!guide.coverPath && category ? (
        <CategoryCover category={category} title={guide.title} label="Featured" large />
      ) : (
        <GuideCover
          slug={guide.slug}
          coverPath={guide.coverPath}
          sizes="(min-width: 1120px) 640px, (min-width: 768px) 58vw, 100vw"
          priority
        />
      )}
      <div className="flex flex-col gap-4 md:pr-4">
        <h2 className="text-h2">
          <Link
            href={`/guides/${guide.slug}`}
            className="transition-colors duration-150 group-hover:text-accent after:absolute after:inset-0 after:rounded-[28px]"
          >
            {guide.title}
          </Link>
        </h2>
        {guide.excerpt && <p className="text-[17px] text-text-2">{guide.excerpt}</p>}
        {guide.author && (
          <p className="flex items-center gap-2.5 font-medium">
            <AuthorAvatar author={guide.author} size={32} />
            {guide.author.name}
          </p>
        )}
        <p className="text-small">
          {guide.readMinutes} min read · Updated {updated(guide.updatedAt)}
        </p>
        <p className="flex items-center gap-1.5 font-semibold text-accent">
          Read the guide
          <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
        </p>
      </div>
    </article>
  );
}
