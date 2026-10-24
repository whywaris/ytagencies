import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { AuthorAvatar, AuthorLinks, GuideCard } from "@/components/guides/guide-parts";
import { JsonLd } from "@/components/json-ld";
import {
  getAuthorBySlug,
  getGuideCategories,
  getLiveAuthors,
  mediaUrl,
} from "@/lib/data/guides";
import { firstThatFits } from "@/lib/directory";
import { breadcrumbJsonLd, personJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

// Author pages: only for authors with at least one live guide (RLS hides the rest, so they 404).
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getLiveAuthors()).map((a) => ({ slug: a.slug }));
}

async function load(params: PageProps<"/authors/[slug]">["params"]) {
  const author = await getAuthorBySlug((await params).slug);
  if (!author) notFound();
  return author;
}

export async function generateMetadata({ params }: PageProps<"/authors/[slug]">) {
  const a = await load(params);
  const n = a.guides.length;
  return buildMetadata({
    title: firstThatFits(
      [
        `${a.name}${a.role ? `, ${a.role}` : ""} | ${BRAND_NAME}`,
        `${a.name} | ${BRAND_NAME}`,
        a.name,
      ],
      60,
    ),
    description:
      a.bio ||
      `${n} ${n === 1 ? "guide" : "guides"} by ${a.name} on choosing and working with YouTube agencies.`,
    path: `/authors/${a.slug}`,
  });
}

export default async function AuthorPage({ params }: PageProps<"/authors/[slug]">) {
  const [a, categories] = await Promise.all([load(params), getGuideCategories()]);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: a.name, path: `/authors/${a.slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={personJsonLd({
          slug: a.slug,
          name: a.name,
          role: a.role,
          bio: a.bio,
          image: a.avatarPath ? mediaUrl(a.avatarPath) : null,
          sameAs: a.links.map((l) => l.href),
        })}
      />
      <div className="mx-auto flex max-w-content flex-col gap-16 px-4 pt-10 pb-20 md:px-6 md:pt-16">
        <header className="flex max-w-reading flex-col gap-6">
          <Breadcrumbs items={crumbs} />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <AuthorAvatar author={a} size={96} />
            <div className="flex flex-col gap-1">
              <h1 className="text-h1">{a.name}</h1>
              {a.role && <p className="text-[19px] text-text-2">{a.role}</p>}
            </div>
          </div>
          {a.bio && <p className="text-[18px] leading-relaxed">{a.bio}</p>}
          <AuthorLinks author={a} />
        </header>

        <section aria-labelledby="author-guides" className="flex flex-col gap-8">
          <h2 id="author-guides" className="text-h2">
            Guides by {a.name}
          </h2>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {a.guides.map((g) => (
              <GuideCard
                key={g.slug}
                guide={g}
                excerpt
                showAuthor={false}
                category={categories.find((c) => c.id === g.categoryId) ?? null}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
