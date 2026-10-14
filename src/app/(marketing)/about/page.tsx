import Image from "next/image";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/company";
import { getAgencyCount } from "@/lib/data/agencies";
import { getLiveGuides } from "@/lib/data/guides";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { breadcrumbJsonLd, organizationJsonLd, webPageJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

// /about. Every number is live from the database; the founder card appears once lib/company.ts
// has the founder's name, role and bio. Nothing here is made up.
export const revalidate = 3600;

const TITLE = "About YT Agencies";
const DESCRIPTION =
  "YT Agencies is an independent directory that helps businesses find YouTube agencies by service and industry. How it works, how we make money and who runs it.";

export const metadata = buildMetadata({
  title: `About | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/about",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
];

const STEPS = {
  businesses: [
    {
      title: "Choose what you need",
      text: "Pick a service, such as YouTube ads or channel management, and your industry.",
    },
    {
      title: "Compare agencies",
      text: "See each agency's starting budget, specialties, case studies and reviews side by side.",
    },
    {
      title: "Get in touch for free",
      text: "Message an agency directly, or tell us what you need and we'll pass it to up to three that fit.",
    },
  ],
  agencies: [
    {
      title: "List your agency for free",
      text: "Add your services, the industries you work with and your starting budget. We review every new listing.",
    },
    {
      title: "Show your work",
      text: "Add case studies with real numbers, and get Verified once we've checked your YouTube channels.",
    },
    {
      title: "Hear from the right businesses",
      text: "With Pro, inquiries arrive in your dashboard and inbox.",
    },
  ],
};

const count = new Intl.NumberFormat("en-US");

export default async function AboutPage() {
  const [agencies, services, industries, guides] = await Promise.all([
    getAgencyCount(),
    getServices(),
    getIndustries(),
    getLiveGuides(),
  ]);
  const numbers = [
    { label: agencies === 1 ? "Published agency" : "Published agencies", value: agencies },
    { label: services.length === 1 ? "Service" : "Services", value: services.length },
    { label: industries.length === 1 ? "Industry" : "Industries", value: industries.length },
    { label: guides.length === 1 ? "Guide" : "Guides", value: guides.length },
  ].filter((n) => n.value > 0);
  const { founder } = COMPANY;
  const showFounder = !!(founder.name && founder.role && founder.bio);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={webPageJsonLd({
          type: "AboutPage",
          name: TITLE,
          description: DESCRIPTION,
          path: "/about",
        })}
      />
      <JsonLd data={organizationJsonLd()} />

      <div className="mx-auto flex max-w-content flex-col gap-20 px-4 pt-10 pb-24 md:px-6 md:pt-16">
        <header className="flex max-w-reading flex-col gap-5">
          <Breadcrumbs items={crumbs} />
          <h1 className="text-display">An independent directory of YouTube agencies.</h1>
          <p className="text-[19px] leading-relaxed text-text-2">
            {BRAND_NAME} helps businesses compare agencies by service and industry, and contact them
            for free.
          </p>
        </header>

        {numbers.length > 0 && (
          <section aria-label="The directory today">
            <dl className="grid grid-cols-2 gap-y-8 border-y border-line py-8 md:grid-cols-4 md:divide-x md:divide-line">
              {numbers.map((n) => (
                <div key={n.label} className="flex flex-col gap-1 md:px-8 md:first:pl-0">
                  <dt className="order-2 text-[15px] text-text-2">{n.label}</dt>
                  <dd className="text-h1 tabular-nums">{count.format(n.value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section aria-labelledby="how-it-works" className="flex flex-col gap-10">
          <h2 id="how-it-works" className="text-h2">
            How it works
          </h2>
          <div className="grid gap-12 md:grid-cols-2">
            {(
              [
                ["For businesses", STEPS.businesses],
                ["For agencies", STEPS.agencies],
              ] as const
            ).map(([heading, steps]) => (
              <div key={heading} className="flex flex-col gap-6">
                <h3 className="text-h3">{heading}</h3>
                <ol className="flex flex-col gap-5">
                  {steps.map((s, i) => (
                    <li key={s.title} className="flex gap-4">
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-[15px] font-medium text-text-2 tabular-nums"
                      >
                        {i + 1}
                      </span>
                      <div className="flex flex-col gap-1">
                        <p className="font-semibold">{s.title}</p>
                        <p className="text-text-2">{s.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="how-we-make-money" className="flex max-w-reading flex-col gap-4">
          <h2 id="how-we-make-money" className="text-h2">
            How we make money
          </h2>
          <p className="text-[17px] leading-relaxed">
            Businesses never pay us, and listing an agency is free. To manage its listing and
            receive inquiries, an agency needs Pro; Pro doesn&apos;t change where it ranks. Agencies
            on Pro can also sponsor a place at the top of a directory page. Sponsored places are
            always labeled, and nothing else about the order can be bought.
          </p>
          <p className="text-[17px]">
            <Link href="/disclosure" className="text-accent underline underline-offset-2">
              Read our disclosure
            </Link>{" "}
            or see{" "}
            <Link href="/how-we-rank" className="text-accent underline underline-offset-2">
              how we rank agencies
            </Link>
            .
          </p>
        </section>

        {showFounder && (
          <section aria-labelledby="whos-behind-it" className="flex max-w-reading flex-col gap-6">
            <h2 id="whos-behind-it" className="text-h2">
              Who&apos;s behind it
            </h2>
            <div className="flex flex-col gap-5 rounded-2xl border border-line p-6 sm:flex-row">
              {founder.photoPath && (
                <Image
                  src={founder.photoPath}
                  alt={founder.name ?? ""}
                  width={96}
                  height={96}
                  className="size-24 shrink-0 rounded-full object-cover"
                />
              )}
              <div className="flex flex-col gap-1">
                <p className="text-[19px] font-semibold">{founder.name}</p>
                <p className="text-small">{founder.role}</p>
                <p className="mt-2 leading-relaxed">{founder.bio}</p>
                {founder.linkedinUrl && (
                  <a
                    href={founder.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="mt-1 flex min-h-11 items-center self-start text-accent hover:underline"
                  >
                    LinkedIn
                    <span className="sr-only"> profile of {founder.name} (opens in a new tab)</span>
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        <section
          aria-labelledby="get-started"
          className="flex flex-col gap-6 rounded-2xl bg-surface p-8 md:flex-row md:items-center md:justify-between md:p-10"
        >
          <h2 id="get-started" className="text-h3">
            Looking for an agency, or run one?
          </h2>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild>
              <Link href="/#services">Find an agency</Link>
            </Button>
            <Link
              href="/list-your-agency"
              className="flex min-h-11 items-center font-medium text-accent hover:underline"
            >
              List your agency
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
