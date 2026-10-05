import Link from "next/link";

import { HeroSearch } from "@/components/hero-search";
import { JsonLd } from "@/components/json-ld";
import { getAgencyCount, getPopularIndustries } from "@/lib/data/agencies";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { breadcrumbJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

export const revalidate = 3600;

export async function generateMetadata() {
  const count = await getAgencyCount();
  return buildMetadata({
    title: `Find a YouTube agency by service and industry | ${BRAND_NAME}`,
    description: `Compare ${count} YouTube agencies for ads, SEO, channel management and Shorts. Filter by industry and location, then contact agencies directly. Free.`,
    path: "/",
  });
}

const steps = [
  {
    title: "Tell us what you need",
    body: "Pick a service and your industry. We show agencies that do that work for businesses like yours.",
  },
  {
    title: "Compare agencies",
    body: "See minimum budgets, specialties, case studies and reviews side by side, one row per agency.",
  },
  {
    title: "Contact them directly",
    body: "Send an inquiry to the agencies you like. It's free, and you deal with them directly.",
  },
];

// "YouTube Ads" → "Ads", so the sentence doesn't read "a YouTube YouTube Ads agency".
const shortServiceName = (name: string) => name.replace(/^YouTube\s+/, "");

const rowLink =
  "flex min-h-11 flex-col justify-center rounded-lg border border-line px-5 py-4 transition-colors duration-150 ease-out hover:border-text-2";

export default async function HomePage() {
  const [services, industries, popular] = await Promise.all([
    getServices(),
    getIndustries(),
    getPopularIndustries(8),
  ]);

  const defaultIndustry =
    industries.find((i) => i.slug === "doctors")?.slug ?? industries[0]?.slug ?? "";

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }])} />

      <section className="mx-auto flex max-w-content flex-col items-center gap-8 px-4 py-20 text-center md:px-6 md:py-30">
        <h1 className="sr-only">Find a YouTube agency by service and industry</h1>
        {services.length > 0 && industries.length > 0 && (
          <HeroSearch
            services={services.map((s) => ({ slug: s.slug, label: shortServiceName(s.name) }))}
            industries={industries.map((i) => ({ slug: i.slug, label: i.name }))}
            defaultService={services[0].slug}
            defaultIndustry={defaultIndustry}
          />
        )}
        <p className="max-w-[56ch] text-text-2">
          Compare agencies that run YouTube ads, grow channels and make videos for businesses in
          your industry. Free for businesses.
        </p>
      </section>

      <section
        id="services"
        aria-labelledby="services-heading"
        className="scroll-mt-16 border-t border-line bg-surface"
      >
        <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-20 md:px-6">
          <h2 id="services-heading" className="text-h2">
            Browse by service
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <li key={s.slug}>
                <Link href={`/${s.slug}`} className={`${rowLink} bg-bg`}>
                  <span className="font-medium">{s.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {popular.length > 0 && (
        <section id="industries" aria-labelledby="industries-heading" className="scroll-mt-16">
          <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-20 md:px-6">
            <h2 id="industries-heading" className="text-h2">
              Popular industries
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map(({ industry, service, count }) => (
                <li key={industry.slug}>
                  <Link href={`/${service.slug}/for-${industry.slug}`} className={rowLink}>
                    <span className="font-medium">{industry.name}</span>
                    <span className="text-small">
                      {service.name} · {count} {count === 1 ? "agency" : "agencies"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="how-heading" className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-20 md:px-6">
          <h2 id="how-heading" className="text-h2">
            How it works
          </h2>
          <ol className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span className="text-h3 text-accent" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="text-h3">{step.title}</h3>
                <p className="max-w-[40ch] text-text-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
