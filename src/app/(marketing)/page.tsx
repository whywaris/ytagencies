import { GuidesIndex, guidesView } from "@/components/guides/guides-index";
import { JsonLd } from "@/components/json-ld";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

// The blog's front page: every live guide, newest first (static here; search and paging live on
// /guides).
export const revalidate = 3600;

const DESCRIPTION =
  "Practical guides on YouTube for businesses and creators: ads, SEO, Shorts, channel growth and what it costs to get help.";

export const metadata = buildMetadata({
  title: `${BRAND_NAME}: YouTube guides for businesses and creators`,
  description: DESCRIPTION,
  path: "/",
});

export default async function HomePage() {
  const view = await guidesView(null, {}, { all: true });
  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={organizationJsonLd()} />
      <GuidesIndex view={view} description={DESCRIPTION} home />
    </>
  );
}
