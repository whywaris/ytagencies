import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideCard, GuideCover, GuideMeta } from "@/components/guides/guide-parts";
import { JsonLd } from "@/components/json-ld";
import { getLiveGuides, type GuideSummary } from "@/lib/data/guides";
import { getServices } from "@/lib/data/taxonomy";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

// /guides: the newest guide featured, then a grid; ?service= filters, ?page= paginates.
// Reading the query makes this page render on request (the data reads are cached per request).
// SEO.md: filtered views are noindex and canonical to /guides; ?page=N is self-canonical.

const PER_PAGE = 12;
const TITLE = `Guides to hiring a YouTube agency | ${BRAND_NAME}`;
const DESCRIPTION =
  "Plain-language guides to hiring a YouTube agency: what agencies cost, how pricing works, what to ask before you sign, and how to judge results honestly.";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Guides", path: "/guides" },
];

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

async function view(searchParams: PageProps<"/guides">["searchParams"]) {
  const sp = await searchParams;
  const [guides, services] = await Promise.all([getLiveGuides(), getServices()]);
  // Chips: only services that have guides.
  const used = new Set(guides.flatMap((g) => g.serviceIds));
  const chips = services.filter((s) => used.has(s.id));
  const service = chips.find((s) => s.slug === one(sp.service)) ?? null;
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);

  const filtered = service ? guides.filter((g) => g.serviceIds.includes(service.id)) : guides;
  // The newest guide is featured on the unfiltered first page only.
  const featured = !service && page === 1 ? (filtered[0] ?? null) : null;
  const rest = service ? filtered : filtered.slice(1);
  const pages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const shown = rest.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  return { guides, chips, service, page, pages, featured, shown, invalid: page > pages };
}

const href = (service: string | null, page = 1) => {
  const p = new URLSearchParams();
  if (service) p.set("service", service);
  if (page > 1) p.set("page", String(page));
  return p.size ? `/guides?${p}` : "/guides";
};

export async function generateMetadata({ searchParams }: PageProps<"/guides">) {
  const { service, page } = await view(searchParams);
  return buildMetadata({
    title: page > 1 && !service ? `Guides, page ${page} | ${BRAND_NAME}` : TITLE,
    description: DESCRIPTION,
    path: service ? "/guides" : href(null, page),
    noindex: !!service,
  });
}

export default async function GuidesPage({ searchParams }: PageProps<"/guides">) {
  const { chips, service, page, pages, featured, shown, invalid } = await view(searchParams);
  if (invalid) notFound();
  const listed: GuideSummary[] = [...(featured ? [featured] : []), ...shown];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />
      <JsonLd
        data={collectionPageJsonLd({
          path: href(service?.slug ?? null, page),
          name: "Guides",
          description: DESCRIPTION,
          items: listed.map((g) => ({ path: `/guides/${g.slug}`, name: g.title })),
        })}
      />
      <div className="mx-auto flex max-w-content flex-col gap-12 px-4 pt-10 pb-20 md:px-6 md:pt-16">
        <header className="flex max-w-reading flex-col gap-4">
          <Breadcrumbs items={CRUMBS} />
          <h1 className="text-display">Guides</h1>
          <p className="text-[19px] text-text-2">
            What YouTube agencies cost, how they work and how to pick one, written from what we see
            in the directory.
          </p>
        </header>

        {featured && (
          <article className="group relative grid items-center gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10">
            <GuideCover
              slug={featured.slug}
              coverPath={featured.coverPath}
              sizes="(min-width: 1120px) 640px, (min-width: 768px) 58vw, 100vw"
              priority
            />
            <div className="flex flex-col gap-3">
              <h2 className="text-h2">
                <Link
                  href={`/guides/${featured.slug}`}
                  className="group-hover:underline after:absolute after:inset-0 after:rounded-2xl"
                >
                  {featured.title}
                </Link>
              </h2>
              {featured.excerpt && <p className="text-[17px] text-text-2">{featured.excerpt}</p>}
              <GuideMeta guide={featured} />
            </div>
          </article>
        )}

        {chips.length > 1 && (
          <nav aria-label="Filter guides by service">
            <ul className="flex flex-wrap gap-2">
              {[{ slug: null, name: "All guides" }, ...chips].map((c) => {
                const current = (service?.slug ?? null) === c.slug;
                return (
                  <li key={c.slug ?? "all"}>
                    <Link
                      href={href(c.slug)}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center rounded-full border px-4 text-[15px] transition-colors duration-150",
                        current
                          ? "border-text bg-text text-bg"
                          : "border-line text-text-2 hover:border-text-2 hover:text-text",
                      )}
                    >
                      {c.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {shown.length > 0 ? (
          <section aria-label={service ? `${service.name} guides` : "All guides"}>
            <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((g) => (
                <GuideCard key={g.slug} guide={g} excerpt as="h2" />
              ))}
            </div>
          </section>
        ) : (
          !featured && (
            <p className="text-text-2">
              No guides here yet.{" "}
              <Link href="/guides" className="text-accent hover:underline">
                See all guides
              </Link>
            </p>
          )
        )}

        {pages > 1 && (
          <nav
            aria-label="Pages"
            className="flex items-center justify-between border-t border-line pt-6"
          >
            {page > 1 ? (
              <Link
                href={href(service?.slug ?? null, page - 1)}
                className="flex min-h-11 items-center text-accent hover:underline"
              >
                Newer guides
              </Link>
            ) : (
              <span />
            )}
            <span className="text-small">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link
                href={href(service?.slug ?? null, page + 1)}
                className="flex min-h-11 items-center text-accent hover:underline"
              >
                Older guides
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </>
  );
}
