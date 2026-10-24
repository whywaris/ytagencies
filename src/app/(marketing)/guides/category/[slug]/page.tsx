import { notFound, permanentRedirect } from "next/navigation";

import { GuidesIndex, guidesPath, guidesView } from "@/components/guides/guides-index";
import { getCategoryRedirect } from "@/lib/data/guides";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

// /guides/category/[slug]: one category's guides, without the featured card. SEO.md: indexed
// (and in the sitemap) from 3 live guides, else noindex,follow; a renamed slug 301s to the new one.

type Props = PageProps<"/guides/category/[slug]">;

async function load({ params, searchParams }: Props) {
  const { slug } = await params;
  const view = await guidesView(slug, await searchParams);
  if (!view.current) {
    const moved = await getCategoryRedirect(slug);
    if (moved) permanentRedirect(guidesPath(moved));
  }
  if (view.missing || !view.current) notFound();
  return { view, current: view.current };
}

const describe = (c: { name: string; description: string | null }) =>
  c.description ?? `Guides on ${c.name.toLowerCase()} when you hire a YouTube agency.`;

export async function generateMetadata(props: Props) {
  const { view, current } = await load(props);
  return buildMetadata({
    title: `${current.name} guides${view.page > 1 ? `, page ${view.page}` : ""} | ${BRAND_NAME}`,
    description: describe(current),
    path: guidesPath(current.slug, view.page),
    noindex: !view.indexable,
  });
}

export default async function GuideCategoryPage(props: Props) {
  const { view, current } = await load(props);
  return <GuidesIndex view={view} description={describe(current)} />;
}
