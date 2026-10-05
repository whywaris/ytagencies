import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { GUIDES } from "@/content/guides/registry";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";
import { firstThatFits } from "@/lib/directory";

export const revalidate = 3600;
export const dynamicParams = false; // unknown slugs 404

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }));
}

async function load(params: PageProps<"/guides/[slug]">["params"]) {
  const { slug } = await params;
  const loader = GUIDES[slug];
  if (!loader) notFound();
  return { slug, ...(await loader()) };
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">) {
  const { slug, meta } = await load(params);
  return buildMetadata({
    title: firstThatFits([`${meta.title} | ${BRAND_NAME}`, meta.title], 60),
    description: meta.description,
    path: `/guides/${slug}`,
    image: `/og/guide/${slug}`,
  });
}

const date = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug, meta, default: Content } = await load(params);
  const path = `/guides/${slug}`;
  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: meta.title, path },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <JsonLd data={articleJsonLd({ path, ...meta, image: `/og/guide/${slug}` })} />
      <article className="mx-auto flex max-w-reading flex-col px-4 py-12 md:py-20">
        <Breadcrumbs items={breadcrumbs} />
        <header className="mt-6 mb-10 flex flex-col gap-4">
          <h1 className="text-h1">{meta.title}</h1>
          <p className="text-small">
            {meta.author} · Updated <time dateTime={meta.updated}>{date(meta.updated)}</time>
          </p>
        </header>
        <Content />
        <aside
          aria-labelledby="related"
          className="mt-12 flex flex-col gap-3 border-t border-line pt-8"
        >
          <h2 id="related" className="text-h3">
            Find an agency
          </h2>
          <ul className="flex flex-col">
            {meta.related.map((r) => (
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
      </article>
    </>
  );
}
