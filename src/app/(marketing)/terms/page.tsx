import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/site";
import { PAGE_UPDATED } from "@/lib/page-dates";

// Plain-language terms for the blog. LAUNCH: fill in the legal name in lib/company.ts and have
// them reviewed.

const UPDATED = PAGE_UPDATED["/terms"];
const TITLE = "Terms of use";
const DESCRIPTION = `The terms for using ${BRAND_NAME}, a free blog of YouTube guides: how you can use our content, estimates and outside links, ads, and our limits.`;

export const metadata = buildMetadata({
  title: `Terms of use | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/terms",
});

const operator = COMPANY.legalName ? `${COMPANY.legalName}, trading as ${BRAND_NAME}` : BRAND_NAME;
const email = COMPANY.email;

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance",
    body: (
      <p>
        {SITE_DOMAIN} is run by {operator} (&ldquo;we&rdquo;). By using the site you agree to these
        terms. If you don&apos;t agree, please don&apos;t use it.
      </p>
    ),
  },
  {
    id: "about-this-site",
    title: "About this site",
    body: (
      <p>
        {BRAND_NAME} is a free, informational blog of guides on YouTube for businesses and creators.
        We don&apos;t sell services, and we&apos;re independent: not affiliated with, endorsed by or
        sponsored by YouTube or Google. YouTube is a trademark of Google LLC.
      </p>
    ),
  },
  {
    id: "content-and-ip",
    title: "Use of content and intellectual property",
    body: (
      <>
        <p>
          The site&apos;s design, text, images and guides belong to us unless we say otherwise. You
          can quote short passages and link to any page, with credit to {BRAND_NAME}. Don&apos;t
          copy, republish or sell our guides, in full or in large parts, without our written
          permission.
        </p>
        <p>
          Don&apos;t scrape the site in bulk, or use it to break the law or anyone&apos;s rights.
        </p>
      </>
    ),
  },
  {
    id: "no-professional-advice",
    title: "No professional advice",
    body: (
      <p>
        Our guides are general information. They aren&apos;t financial, legal, tax or marketing
        advice for your situation. For decisions that matter, check with a qualified professional.
      </p>
    ),
  },
  {
    id: "accuracy-and-estimates",
    title: "Accuracy and estimates",
    body: (
      <p>
        We work to keep guides accurate and say when we last updated them. Prices, costs, fees and
        platform rules are estimates from the sources we cite at the time of writing, and they
        change. Check the current figures with the provider before you rely on them. Our{" "}
        <Link href="/disclaimer">disclaimer</Link> says more.
      </p>
    ),
  },
  {
    id: "third-party-links",
    title: "Third-party links",
    body: (
      <p>
        Guides link to other websites. We don&apos;t control them and aren&apos;t responsible for
        their content, products or privacy practices. A link isn&apos;t an endorsement.
      </p>
    ),
  },
  {
    id: "advertising",
    title: "Advertising",
    body: (
      <p>
        Some pages show ads served by Google AdSense. We don&apos;t choose the individual ads, and
        ads don&apos;t influence what we write. Our <Link href="/privacy">privacy policy</Link>{" "}
        explains how ads use cookies and how to opt out.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <>
        <p>
          We provide the site as it is, without guarantees that it will always be available or
          error-free. As far as the law allows, we aren&apos;t liable for any loss from using the
          site or acting on a guide, including indirect losses or lost profits.
        </p>
        <p>Nothing in these terms limits liability that can&apos;t be limited by law.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms. When we do, we change the date at the top of this page. Using the
        site after a change means you accept the new terms.
      </p>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of {COMPANY.jurisdiction ?? "Pakistan"}, and its courts
        deal with any dispute. If you&apos;re a consumer, you keep the protections of the law where
        you live.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms: <a href={`mailto:${email}`}>{email}</a>, or use the{" "}
        <Link href="/contact">contact form</Link>.
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
        `${BRAND_NAME} is a free, independent blog of YouTube guides, not affiliated with YouTube or Google.`,
        "Guides are general information, not professional advice. Prices and costs are estimates that change.",
        "Quote and link to our guides with credit; don't copy them wholesale.",
        "Some pages show Google ads; we aren't responsible for outside sites and ads.",
      ]}
      sections={sections}
    />
  );
}
