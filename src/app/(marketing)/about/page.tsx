import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { prose } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { getGuideCategories, getLiveAuthors, getLiveGuides } from "@/lib/data/guides";
import { breadcrumbJsonLd, organizationJsonLd, webPageJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

// /about. Counts are live from the database (ISR hourly); company facts come from lib/company.ts.
// Nothing here is made up.
export const revalidate = 3600;

const TITLE = `About ${BRAND_NAME}`;
const DESCRIPTION = `${BRAND_NAME} publishes practical guides on YouTube for businesses and creators: ads, SEO, Shorts, channel growth and what it costs to get help.`;

export const metadata = buildMetadata({
  title: `About | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/about",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
];

export default async function AboutPage() {
  const [guides, categories, authors] = await Promise.all([
    getLiveGuides(),
    getGuideCategories(),
    getLiveAuthors(),
  ]);
  const used = categories.filter((c) => guides.some((g) => g.categoryId === c.id));
  const founder = COMPANY.founder.name;
  const founderPage = founder ? authors.find((a) => a.name === founder) : undefined;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={organizationJsonLd()} />
      <JsonLd
        data={webPageJsonLd({
          type: "AboutPage",
          name: TITLE,
          description: DESCRIPTION,
          path: "/about",
        })}
      />
      <div className="mx-auto flex max-w-reading flex-col gap-8 px-4 pt-10 pb-20 md:px-6 md:pt-16">
        <header className="flex flex-col gap-4">
          <Breadcrumbs items={crumbs} />
          <h1 className="text-h1">{TITLE}</h1>
          <p className="text-[19px] text-text-2">{DESCRIPTION}</p>
        </header>

        <div className={cn("text-[17px]", prose)}>
          <h2 className="mb-3 text-h3">What we write about</h2>
          <p>
            Plain, practical answers for people who use YouTube to grow a business or a channel: how
            YouTube ads and SEO work, how to plan Shorts and scripts, and what hiring an editor or
            an agency really costs. We have published {guides.length}{" "}
            {guides.length === 1 ? "guide" : "guides"} so far
            {used.length > 0 && <>, on {used.map((c) => c.name.toLowerCase()).join(", ")}</>}.
          </p>
          <p>
            Start with the <Link href="/guides">latest guides</Link>, or read how we research and
            correct them in our <Link href="/editorial-policy">editorial policy</Link>.
          </p>

          <h2 className="mt-8 mb-3 text-h3">Who runs {BRAND_NAME}</h2>
          {COMPANY.founder.photoPath && (
            // ponytail: plain <img> for one fixed-size photo in /public; next/image if it moves to a CDN.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={COMPANY.founder.photoPath}
              alt={COMPANY.founder.name ?? ""}
              width={96}
              height={96}
              className="mb-4 size-24 rounded-full object-cover"
            />
          )}
          <p>
            {BRAND_NAME} is written by Waris Jamil, a freelancer based in Multan, Pakistan, who works
            with YouTube creators. He also built{" "}
            <a href="https://ytcrew.com" rel="noopener">
              ytcrew.com
            </a>
            , a free YouTube creator toolkit.
            {COMPANY.founder.linkedinUrl && (
              <>
                {" "}
                You can find him on <a href={COMPANY.founder.linkedinUrl}>LinkedIn</a>.
              </>
            )}
          </p>
          {/* TODO(owner): why you started the site, in your own words, if you want it here. */}
          <p>
            The site exists to give plain answers to the questions people ask before they spend
            money on YouTube: what ads or channel management cost, which help is worth paying for,
            and what you can do yourself.
          </p>
          <p>
            Each guide is researched from primary sources: platform documentation, official pricing
            pages and published studies, and the sources are linked in the guide.
          </p>

          <h2 className="mt-8 mb-3 text-h3">When we started</h2>
          <p>
            {BRAND_NAME} started in {COMPANY.foundedYear}
            {COMPANY.city && COMPANY.country && (
              <>
                {" "}
                and is run from {COMPANY.city}, {COMPANY.country}
              </>
            )}
            {founder && (
              <>
                {" "}
                by{" "}
                {founderPage ? (
                  <Link href={`/authors/${founderPage.slug}`}>{founder}</Link>
                ) : (
                  founder
                )}
              </>
            )}
            . We&apos;re independent and not affiliated with YouTube or Google.
          </p>

          <h2 className="mt-8 mb-3 text-h3">How the site is paid for</h2>
          <p>
            Some pages may show ads from Google AdSense. Ads never decide what we write or
            recommend. The <Link href="/privacy">privacy policy</Link> explains what that means for
            your data.
          </p>

          <h2 className="mt-8 mb-3 text-h3">Get in touch</h2>
          <p>
            Spotted a mistake, or want us to cover something? Use the{" "}
            <Link href="/contact">contact form</Link> or email{" "}
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
          </p>
        </div>
      </div>
    </>
  );
}
