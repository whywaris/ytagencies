import { notFound } from "next/navigation";

import { GuidesIndex, guidesPath, guidesView } from "@/components/guides/guides-index";
import { guidesSearchRobots } from "@/lib/guide-categories";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

// /guides: featured guide, category tabs, a grid; ?q= searches, ?page= paginates. Reading the
// query makes this page render on request (the data reads are cached per request).
// SEO.md: search results are noindex,follow and canonical to /guides; ?page=N is self-canonical.

const TITLE = `Guides to choosing a YouTube agency | ${BRAND_NAME}`;
const DESCRIPTION =
  "Plain answers on YouTube agency prices, contracts and results: what agencies cost, what to ask before you sign, and how to judge results honestly.";

export async function generateMetadata({ searchParams }: PageProps<"/guides">) {
  const { q, page } = await guidesView(null, await searchParams);
  const robots = guidesSearchRobots(q);
  return buildMetadata({
    title: page > 1 && !q ? `Guides, page ${page} | ${BRAND_NAME}` : TITLE,
    description: DESCRIPTION,
    path: robots.canonical ?? guidesPath(null, page),
    noindex: robots.noindex,
  });
}

export default async function GuidesPage({ searchParams }: PageProps<"/guides">) {
  const view = await guidesView(null, await searchParams);
  if (view.missing) notFound();
  return <GuidesIndex view={view} description={DESCRIPTION} />;
}
