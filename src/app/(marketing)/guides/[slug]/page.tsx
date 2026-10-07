import { notFound, permanentRedirect } from "next/navigation";

import { BudgetRange } from "@/components/guides/budget-range";
import { GuideArticle } from "@/components/guides/guide-article";
import { JsonLd } from "@/components/json-ld";
import { getGuideBySlug, getGuideRedirect, getLiveGuides, relatedGuides } from "@/lib/data/guides";
import { firstThatFits } from "@/lib/directory";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { absoluteUrl, BRAND_NAME } from "@/lib/site";

// Guides come from the CMS (ADMIN_V2_SPEC §8). ISR: publishing revalidates the page straight
// away; scheduled guides appear on the next hourly revalidation (or the daily cron sweep).
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getLiveGuides()).map((g) => ({ slug: g.slug }));
}

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

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const g = await load(params);
  const path = `/guides/${g.slug}`;
  const more = await relatedGuides(g.slug, g.serviceIds);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: g.title, path },
        ])}
      />
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
      <GuideArticle
        guide={g}
        primaryService={g.related[0]?.service ?? null}
        related={g.related}
        relatedGuides={more}
        shareUrl={absoluteUrl(path)}
        budgetRange={(service) => <BudgetRange service={service} />}
      />
    </>
  );
}
