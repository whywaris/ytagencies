import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/site";
import { PAGE_UPDATED } from "@/lib/page-dates";

// LAUNCH: plain-language terms. Fill in the legal name and jurisdiction in lib/company.ts and
// have them reviewed before launch.

const UPDATED = PAGE_UPDATED["/terms"];
const TITLE = "Terms of use";
const DESCRIPTION = `Terms for using ${BRAND_NAME}: what our guides are, how you can use them, ads and outside links, and our limits.`;

export const metadata = buildMetadata({
  title: `Terms of use | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/terms",
});

const operator = COMPANY.legalName ? `${COMPANY.legalName}, trading as ${BRAND_NAME}` : BRAND_NAME;
const email = COMPANY.email;

const sections: LegalSection[] = [
  {
    id: "about-these-terms",
    title: "About these terms",
    body: (
      <p>
        {SITE_DOMAIN} is run by {operator} (&ldquo;we&rdquo;). By using the site you agree to these
        terms.
      </p>
    ),
  },
  {
    id: "what-we-are",
    title: `What ${BRAND_NAME} is`,
    body: (
      <p>
        {BRAND_NAME} publishes guides on YouTube for businesses and creators. Reading them is free.
        Guides are general information, not professional advice for your situation: check prices,
        platform rules and terms with the provider before you rely on them.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Don&apos;t:</p>
        <ul>
          <li>send spam, or messages you don&apos;t mean, through our contact form</li>
          <li>copy or scrape the site in bulk</li>
          <li>try to get around our security checks or access accounts that aren&apos;t yours</li>
          <li>use the site to break the law or someone else&apos;s rights</li>
        </ul>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    body: (
      <>
        <p>
          The site&apos;s design, text and guides belong to us. You can quote and link to them, but
          don&apos;t copy them wholesale.
        </p>
        <p>
          YouTube is a trademark of Google LLC. {BRAND_NAME} is independent and isn&apos;t
          affiliated with YouTube or Google.
        </p>
      </>
    ),
  },
  {
    id: "ads-and-links",
    title: "Ads and outside links",
    body: (
      <p>
        Some pages may show ads from Google AdSense, and guides link to other websites. We
        don&apos;t control those sites or ads and aren&apos;t responsible for them. Our{" "}
        <Link href="/privacy">privacy policy</Link> explains how ads use data.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p>
        We provide the site as it is. We don&apos;t guarantee that it will always be available or
        error-free, or that what a guide describes will get you a particular result.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <>
        <p>
          As far as the law allows, we aren&apos;t liable for indirect losses or lost profits from
          using the site or acting on a guide.
        </p>
        <p>Nothing in these terms limits liability that can&apos;t be limited by law.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: <p>We may update these terms. When we do, we change the date at the top of this page.</p>,
  },
  {
    id: "governing-law",
    title: "Governing law",
    body: (
      <p>
        {COMPANY.jurisdiction
          ? `These terms are governed by the law of ${COMPANY.jurisdiction}, and its courts deal with any dispute.`
          : "These terms are governed by the law of the place where we are established, and its courts deal with any dispute."}{" "}
        If you&apos;re a consumer, you keep the protections of the law where you live.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title={TITLE}
      description={DESCRIPTION}
      path="/terms"
      updated={UPDATED}
      contactEmail={email}
      summary={[
        `${BRAND_NAME} publishes free guides on YouTube for businesses and creators.`,
        "Guides are general information, not professional advice.",
        "You can quote and link to our guides, but don't copy them wholesale.",
        "Some pages may show Google ads; we aren't responsible for outside sites and ads.",
      ]}
      sections={sections}
    />
  );
}
