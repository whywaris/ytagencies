import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideBody } from "@/components/guide-body";
import { BudgetRange } from "@/components/guides/budget-range";
import { JsonLd } from "@/components/json-ld";
import { getGuideBySlug, getGuideRedirect, getLiveGuides } from "@/lib/data/guides";
import { firstThatFits } from "@/lib/directory";
import { imageSize } from "@/lib/markdown";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

// Guides come from the CMS (ADMIN_V2_SPEC §8). ISR: publishing revalidates the page straight
// away; scheduled guides appear on the next hourly revalidation (or the daily cron sweep).
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getLiveGuides()).map((g) => ({ slug: g.slug }));
}

const coverUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/agency-media/${path}`;

async function load(params: PageProps<"/guides/[slug]">["params"]) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (guide) return guide;
  // "Change URL" in the editor keeps the old slug working with a permanent redirect.
  const moved = await getGuideRedirect(slug);
  if (moved) permanentRedirect(`/guides/${moved}`);
  notFound();
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">) {
  const g = await load(params);
  return buildMetadata({
    title: g.seoTitle || firstThatFits([`${g.title} | ${BRAND_NAME}`, g.title], 60),
    description: g.description,
    path: `/guides/${g.slug}`,
    image: `/og/guide/${g.slug}`,
  });
}

const date = (d: string) =>
  new Date(d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const g = await load(params);
  const path = `/guides/${g.slug}`;
  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: g.title, path },
  ];
  const cover = g.coverPath ? { src: coverUrl(g.coverPath), size: imageSize(g.coverPath) } : null;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <JsonLd
        data={articleJsonLd({
          path,
          title: g.title,
          description: g.description,
          published: g.publishedAt,
          updated: g.updatedAt,
          author: g.author,
          image: `/og/guide/${g.slug}`,
        })}
      />
      <article className="mx-auto flex max-w-reading flex-col px-4 py-12 md:py-20">
        <Breadcrumbs items={breadcrumbs} />
        <header className="mt-6 mb-10 flex flex-col gap-4">
          <h1 className="text-h1">{g.title}</h1>
          <p className="text-small">
            {g.author}. Updated on <time dateTime={g.updatedAt}>{date(g.updatedAt)}</time>
          </p>
          {cover?.size && (
            <Image
              src={cover.src}
              alt=""
              width={cover.size.width}
              height={cover.size.height}
              sizes="(min-width: 720px) 680px, 100vw"
              priority
              className="mt-4 h-auto w-full rounded-lg"
            />
          )}
        </header>
        <GuideBody md={g.body} budgetRange={(service) => <BudgetRange service={service} />} />
        {g.related.length > 0 && (
          <aside
            aria-labelledby="related"
            className="mt-12 flex flex-col gap-3 border-t border-line pt-8"
          >
            <h2 id="related" className="text-h3">
              Find an agency
            </h2>
            <ul className="flex flex-col">
              {g.related.map((r) => (
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
          </aside>
        )}
      </article>
    </>
  );
}
