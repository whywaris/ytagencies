import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { AgencySearch } from "@/components/forms/agency-search";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

// Static and indexable: it targets agency owners. The search runs as a server action and the
// submission form lives at /list-your-agency/new (sign-in required, noindex).
export const revalidate = 3600;

export const metadata = buildMetadata({
  title: `List your YouTube agency for free | ${BRAND_NAME}`,
  description:
    "Get your YouTube agency in front of businesses looking to hire. Free profile, matched leads by service and industry, and space for your case studies.",
  path: "/list-your-agency",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "List your agency", path: "/list-your-agency" },
];

const benefits = [
  {
    title: "A free profile",
    body: "Your services, the industries you know, your minimum budget and where you work, on a page businesses can find in search.",
  },
  {
    title: "Leads that fit",
    body: "Businesses tell us what they need. We send their request to agencies that do that work for their industry and budget.",
  },
  {
    title: "Proof of your work",
    body: "Add case studies with real numbers. Businesses compare results, not slogans.",
  },
];

export default function ListYourAgencyPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <div className="mx-auto flex max-w-reading flex-col gap-16 px-4 py-12 md:py-20">
        <div className="flex flex-col gap-8">
          <Breadcrumbs items={breadcrumbs} />
          <header className="flex flex-col gap-4">
            <h1 className="text-h1">List your YouTube agency</h1>
            <p className="text-text-2">
              Businesses use {BRAND_NAME} to find agencies for YouTube ads, SEO, channel management,
              production and Shorts. Listing your agency is free.
            </p>
          </header>
          <ul className="flex flex-col gap-6">
            {benefits.map((b) => (
              <li key={b.title} className="flex flex-col gap-1">
                <h2 className="text-h3">{b.title}</h2>
                <p className="text-text-2">{b.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <section aria-labelledby="step-1" className="flex flex-col gap-4">
          <p className="text-small font-medium text-accent">Step 1</p>
          <h2 id="step-1" className="text-h2">
            Check if you&apos;re already listed
          </h2>
          <p className="text-text-2">
            We may have listed your agency already. If so, claim it to edit the profile and receive
            inquiries.
          </p>
          <AgencySearch />
        </section>

        <section aria-labelledby="step-2" className="flex flex-col gap-4">
          <p className="text-small font-medium text-accent">Step 2</p>
          <h2 id="step-2" className="text-h2">
            Not listed? Add your agency
          </h2>
          <p className="text-text-2">
            Tell us about your agency. We review every submission before it goes live, usually
            within a few business days. You&apos;ll need to sign in first, with Google or an email
            link.
          </p>
          <Button asChild className="self-start">
            <Link href="/list-your-agency/new">Add your agency</Link>
          </Button>
        </section>
      </div>
    </>
  );
}
