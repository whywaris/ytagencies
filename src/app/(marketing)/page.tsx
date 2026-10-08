import Link from "next/link";

import { HomeHero } from "@/components/home/hero";
import { JsonLd } from "@/components/json-ld";
import { getAgencyCount, getPopularIndustries } from "@/lib/data/agencies";
import { getServices } from "@/lib/data/taxonomy";
import { breadcrumbJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

export const revalidate = 3600;

export async function generateMetadata() {
  const count = await getAgencyCount();
  return buildMetadata({
    title: `${BRAND_NAME}: Find the right YouTube agency for your business`,
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

const rowLink =
  "flex min-h-11 flex-col justify-center rounded-lg border border-line px-5 py-4 transition-colors duration-150 ease-out hover:border-text-2";

export default async function HomePage() {
  const [services, popular] = await Promise.all([getServices(), getPopularIndustries(8)]);

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }])} />

      <HomeHero />

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
