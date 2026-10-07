import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/site";

// LAUNCH: plain-language terms. Fill in the legal name and jurisdiction in lib/company.ts and
// have them reviewed before launch.

const UPDATED = "2026-10-07";
const TITLE = "Terms of use";
const DESCRIPTION =
  "Terms for using YT Agencies: how the directory works, what agencies agree to when they list, how reviews, paid plans and sponsored places work, and our limits.";

export const metadata = buildMetadata({
  title: `Terms of use | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/terms",
});

const operator = COMPANY.legalName ? `${COMPANY.legalName}, trading as ${BRAND_NAME}` : BRAND_NAME;
const hello = COMPANY.emails.hello;

const sections: LegalSection[] = [
  {
    id: "about-these-terms",
    title: "About these terms",
    body: (
      <p>
        {SITE_DOMAIN} is run by {operator} (&ldquo;we&rdquo;). By using the site you agree to these
        terms. If you use it for a company, you agree for that company.
      </p>
    ),
  },
  {
    id: "what-we-are",
    title: "What YT Agencies is",
    body: (
      <p>
        {BRAND_NAME} is a directory of YouTube agencies. We help businesses find and contact
        agencies. We don&apos;t provide agency services ourselves and we aren&apos;t part of any
        agreement you make with an agency. Check an agency&apos;s terms, pricing and references
        before you hire them.
      </p>
    ),
  },
  {
    id: "using-the-directory",
    title: "Using the directory",
    body: (
      <>
        <p>
          Browsing, comparing and contacting agencies is free. When you send an inquiry or ask to be
          matched, we pass it to the agencies concerned, as described in our{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
        <p>
          Matching depends on which agencies are listed and what they offer. We can&apos;t promise
          that an agency will reply or take on your project.
        </p>
      </>
    ),
  },
  {
    id: "agency-accounts",
    title: "Agency accounts and listings",
    body: (
      <>
        <p>
          Listing an agency is free. You sign in with an email link; keep access to that inbox
          secure, because anyone who can read it can sign in.
        </p>
        <p>
          You must run or work for the agency you list, and keep its details accurate and up to
          date. You&apos;re responsible for what you publish on your listing, including case studies
          and results.
        </p>
        <p>
          We review new listings before they go live. We may edit, unpublish or remove a listing
          that is inaccurate, misleading or breaks these terms.
        </p>
      </>
    ),
  },
  {
    id: "claims-and-accuracy",
    title: "Claims, verification and accuracy",
    body: (
      <>
        <p>
          To claim an existing listing, you confirm an email address on the agency&apos;s own
          website domain, or we review the claim by hand. We never hand over a listing
          automatically.
        </p>
        <p>
          The Verified badge means we checked the agency&apos;s YouTube channels and basic details.
          It isn&apos;t an endorsement of the quality of their work, and it can&apos;t be bought.
        </p>
        <p>
          We work to keep listings accurate, but agencies supply most of the information. Prices,
          budgets and services can change, so confirm them with the agency.
        </p>
      </>
    ),
  },
  {
    id: "reviews",
    title: "Reviews",
    body: (
      <p>
        Reviews must describe real work with the agency. We check every review before it is
        published and may decline or remove reviews that look fake, abusive or off-topic. Agencies
        can&apos;t pay to remove a genuine review.
      </p>
    ),
  },
  {
    id: "paid-plans",
    title: "Paid plans and sponsored places",
    body: (
      <>
        <p>
          Agencies can choose a paid plan or sponsor a directory page. Paid plans place an agency
          above free listings and add features, as described on the{" "}
          <Link href="/for-agencies/pricing">pricing page</Link>. Sponsored places are labeled
          &ldquo;Sponsored&rdquo; wherever they appear. How placement works is explained in{" "}
          <Link href="/how-we-rank">How we rank</Link> and our{" "}
          <Link href="/disclosure">disclosure</Link>.
        </p>
        <p>
          Payments are handled by our payment provider. Cancellations and refunds follow our{" "}
          <Link href="/refunds">refund policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Don&apos;t:</p>
        <ul>
          <li>send spam, or send inquiries you don&apos;t mean, through our forms</li>
          <li>copy or scrape the directory in bulk</li>
          <li>try to get around our security checks or access accounts that aren&apos;t yours</li>
          <li>list an agency you don&apos;t represent, or post false information</li>
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
          Agencies keep ownership of the content they add. By adding it, you let us show it on{" "}
          {BRAND_NAME}, and in links and previews that point to it, for as long as it is listed.
        </p>
        <p>
          YouTube is a trademark of Google LLC. {BRAND_NAME} is independent and isn&apos;t
          affiliated with YouTube or Google.
        </p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p>
        We provide the site as it is. We don&apos;t guarantee that it will always be available or
        error-free, or that any agency will deliver the results you want. Guides are general
        information, not professional advice for your situation.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <>
        <p>
          We aren&apos;t responsible for the work, conduct or results of any agency listed on the
          site. As far as the law allows, we aren&apos;t liable for indirect losses or lost profits,
          and our total liability to you is limited to what you paid us in the 12 months before the
          claim.
        </p>
        <p>Nothing in these terms limits liability that can&apos;t be limited by law.</p>
      </>
    ),
  },
  {
    id: "ending",
    title: "Ending your use",
    body: (
      <p>
        You can stop using the site at any time and ask us to close your account. We may suspend or
        close an account that breaks these terms, and remove its listing.
      </p>
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
      contactEmail={hello}
      summary={[
        "YT Agencies is a free directory. We help you find agencies; we don't do agency work ourselves.",
        "Agencies must keep their listings accurate. We review listings and reviews and can remove ones that break these terms.",
        "Paid plans and sponsored places are optional and always clearly labeled.",
        "We aren't responsible for the work agencies do for you.",
      ]}
      sections={sections}
    />
  );
}
