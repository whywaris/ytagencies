import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";
import { PAGE_UPDATED } from "@/lib/page-dates";

// /disclaimer. Keep "no affiliate relationships" true: if that changes, say so here and at the
// top of the affected guides (docs/SEO.md, editorial policy).

const UPDATED = PAGE_UPDATED["/disclaimer"];
const TITLE = "Disclaimer";
const DESCRIPTION = `What ${BRAND_NAME}'s guides are and aren't: general information, estimates that change, no endorsements or paid placements, and how ads work on the site.`;

export const metadata = buildMetadata({
  title: `Disclaimer | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/disclaimer",
});

const sections: LegalSection[] = [
  {
    id: "information-only",
    title: "Information only",
    body: (
      <p>
        Everything on {BRAND_NAME} is for general information. It isn&apos;t financial, legal, tax
        or marketing advice, and it doesn&apos;t replace advice from a qualified professional who
        knows your situation.
      </p>
    ),
  },
  {
    id: "estimates",
    title: "Prices and costs are estimates",
    body: (
      <p>
        Prices, fees, earnings and costs in our guides are estimates based on the sources we cite
        and the date we checked them. They vary by provider, country and project, and they change.
        Confirm current figures with the provider before you decide anything.
      </p>
    ),
  },
  {
    id: "no-endorsements",
    title: "No endorsements, rankings or paid placements",
    body: (
      <p>
        When a guide mentions an agency, platform or tool, it&apos;s an example, not an endorsement
        or a ranking. No one pays to be mentioned, and we don&apos;t sell placements in our guides.
      </p>
    ),
  },
  {
    id: "affiliates",
    title: "Affiliate links",
    body: (
      <p>
        We currently have no affiliate relationships, so we earn nothing when you click a link or
        buy something. If that changes, the affected pages will say so at the top.
      </p>
    ),
  },
  {
    id: "independence",
    title: "Independent",
    body: (
      <p>
        {BRAND_NAME} is independent and isn&apos;t affiliated with, endorsed by or sponsored by
        YouTube or Google. YouTube is a trademark of Google LLC.
      </p>
    ),
  },
  {
    id: "ads",
    title: "Ads",
    body: (
      <p>
        The site shows ads served by Google AdSense. We don&apos;t choose the individual ads, and
        ads don&apos;t influence what we write or recommend. See our{" "}
        <Link href="/privacy">privacy policy</Link> for how ads use cookies.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Questions or corrections",
    body: (
      <p>
        If something in a guide looks wrong, write to{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or use the{" "}
        <Link href="/contact">contact form</Link>. Our{" "}
        <Link href="/editorial-policy">editorial policy</Link> explains how we fix mistakes.
      </p>
    ),
  },
];

export default function DisclaimerPage() {
  return (
    <LegalPage
      title={TITLE}
      description={DESCRIPTION}
      path="/disclaimer"
      updated={UPDATED}
      contactEmail={COMPANY.email}
      summary={[
        "Our guides are general information, not professional advice.",
        "Prices and costs are estimates that change; check them with the provider.",
        "No one pays to be mentioned, and we have no affiliate relationships.",
        "The site shows Google ads, which don't influence what we write.",
      ]}
      sections={sections}
    />
  );
}
