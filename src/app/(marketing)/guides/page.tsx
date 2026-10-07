import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { getLiveGuides } from "@/lib/data/guides";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: `Guides to hiring a YouTube agency | ${BRAND_NAME}`,
  description:
    "Plain-language guides to hiring a YouTube agency: what agencies cost, how pricing works, what to ask before you sign, and how to judge results honestly.",
  path: "/guides",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Guides", path: "/guides" },
];

export default async function GuidesPage() {
  const guides = await getLiveGuides();

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <div className="mx-auto flex max-w-reading flex-col gap-8 px-4 py-12 md:py-20">
        <Breadcrumbs items={breadcrumbs} />
        <h1 className="text-h1">Guides</h1>
        <ul className="flex flex-col gap-3">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="flex flex-col gap-1 rounded-lg border border-line px-5 py-4 transition-colors duration-150 hover:border-text-2"
              >
                <span className="font-medium">{g.title}</span>
                <span className="text-small">{g.excerpt || g.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
