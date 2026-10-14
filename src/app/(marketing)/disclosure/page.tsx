import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";
import { PAGE_UPDATED } from "@/lib/page-dates";

// How we make money and how paid placement is labeled. Must match lib/ranking.ts and the
// public labels ("Sponsored", rel="sponsored") in the directory.

const UPDATED = PAGE_UPDATED["/disclosure"];
const TITLE = "Disclosure";
const DESCRIPTION =
  "How YT Agencies stays independent of YouTube and Google, how it makes money, how Pro and sponsored places are labeled, and what money can't buy.";

export const metadata = buildMetadata({
  title: `Disclosure: independence and paid placement | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/disclosure",
});

const sections: LegalSection[] = [
  {
    id: "independence",
    title: "We're independent",
    body: (
      <p>
        {BRAND_NAME} is an independent directory. We aren&apos;t affiliated with, endorsed by or
        sponsored by YouTube or Google. We don&apos;t use YouTube&apos;s logo or branding, and
        agencies listed here aren&apos;t certified by us on YouTube&apos;s behalf.
      </p>
    ),
  },
  {
    id: "how-we-make-money",
    title: "How we make money",
    body: (
      <>
        <p>
          Businesses never pay us. Listing an agency is free. We earn money in two optional ways:
        </p>
        <ul>
          <li>
            <strong>Pro for agencies.</strong> Listings are free, but to manage a listing and
            receive inquiries an agency needs Pro. Pro also adds a link to the agency&apos;s website
            and lists it above unmanaged listings. See{" "}
            <Link href="/pricing">pricing</Link>.
          </li>
          <li>
            <strong>Sponsored places.</strong> An agency can pay to appear at the top of a specific
            directory page. There are at most three per page.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-paid-placement-is-labeled",
    title: "How paid placement is labeled",
    body: (
      <ul>
        <li>Sponsored places always carry a &ldquo;Sponsored&rdquo; label.</li>
        <li>
          Only agencies on Pro get a link to their website, and those links are marked as paid (
          <code>rel=&quot;sponsored&quot;</code>) for search engines. They carry tags that let the
          agency see the visits came from {BRAND_NAME}.
        </li>
        <li>
          Profiles of agencies that haven&apos;t joined say so, and offer to match you with agencies
          that have. Their details come from public sources and stay on the directory.
        </li>
      </ul>
    ),
  },
  {
    id: "what-money-cant-buy",
    title: "What money can't buy",
    body: (
      <ul>
        <li>
          A position in the rankings beyond a labeled sponsored place. Within each group, agencies
          are ordered by the same quality score, paid or not.
        </li>
        <li>
          The Verified badge. It&apos;s given only after we check the agency&apos;s YouTube channels
          and details, on any plan.
        </li>
        <li>The removal of a genuine review.</li>
        <li>A mention in our guides.</li>
      </ul>
    ),
  },
  {
    id: "how-we-rank",
    title: "How we rank agencies",
    body: (
      <p>
        The full order, from sponsored places to the quality score, is explained on{" "}
        <Link href="/how-we-rank">How we rank</Link>.
      </p>
    ),
  },
];

export default function DisclosurePage() {
  return (
    <LegalPage
      title={TITLE}
      description={DESCRIPTION}
      path="/disclosure"
      updated={UPDATED}
      contactEmail={COMPANY.email}
      summary={[
        "We're independent and not affiliated with YouTube or Google.",
        "Businesses never pay. Agencies can list for free, or pay for a plan or a sponsored place.",
        "Paid placement is always labeled, and the Verified badge can't be bought.",
      ]}
      sections={sections}
    />
  );
}
