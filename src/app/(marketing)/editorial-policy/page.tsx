import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { getLiveAuthors } from "@/lib/data/guides";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";
import { PAGE_UPDATED } from "@/lib/page-dates";

// How guides are written, checked and corrected, and how ads fit in. The author
// list is live (authors with a published guide).
export const revalidate = 3600;

const UPDATED = PAGE_UPDATED["/editorial-policy"];
const TITLE = "Editorial policy";
const DESCRIPTION =
  "Who writes the YT Agencies guides, how facts are checked and corrected, and why ads and companies we mention have no say in what we publish.";

export const metadata = buildMetadata({
  title: `Editorial policy | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/editorial-policy",
});

const email = COMPANY.email;

export default async function EditorialPolicyPage() {
  const authors = await getLiveAuthors();

  const sections: LegalSection[] = [
    {
      id: "who-writes-our-guides",
      title: "Who writes our guides",
      body: (
        <>
          <p>
            Every guide names its author, with a page about them and the other guides they&apos;ve
            written.
          </p>
          {authors.length > 0 && (
            <ul>
              {authors.map((a) => (
                <li key={a.slug}>
                  <Link href={`/authors/${a.slug}`}>{a.name}</Link>
                  {a.role ? `, ${a.role}` : ""}
                </li>
              ))}
            </ul>
          )}
          <p>No one can pay to be written about or mentioned in a guide.</p>
        </>
      ),
    },
    {
      id: "how-we-check-facts",
      title: "How we check facts",
      body: (
        <>
          <p>
            We use primary sources wherever we can: platform documentation, official pricing pages
            and the companies themselves, and we link to them.
          </p>
          <p>
            When a guide gives a price range or a rule, it&apos;s based on what the provider
            publishes at the time. Prices change, so each guide shows when it was last updated.
          </p>
        </>
      ),
    },
    {
      id: "keeping-guides-current",
      title: "Keeping guides up to date",
      body: (
        <p>
          {COMPANY.guideReviewCycle
            ? `We review every guide ${COMPANY.guideReviewCycle}, and sooner when something it covers changes. `
            : "We update a guide when something it covers changes. "}
          The date at the top of each guide is the last time it was updated.
        </p>
      ),
    },
    {
      id: "corrections",
      title: "Corrections",
      body: (
        <p>
          If you spot a mistake, write to <a href={`mailto:${email}`}>{email}</a> or use the{" "}
          <Link href="/contact">contact form</Link> with the guide and what&apos;s wrong. When we
          confirm an error, we fix it and update the guide&apos;s date.
        </p>
      ),
    },
    {
      id: "independence",
      title: "Ads and independence",
      body: (
        <p>
          Some pages may show ads from Google AdSense. We don&apos;t choose the ads, and no
          advertiser or company we mention has a say in what we write. We&apos;re not affiliated
          with YouTube or Google.
        </p>
      ),
    },
    {
      id: "ai-use",
      title: "AI use",
      body: (
        <p>
          AI tools may help with research and drafting. Every guide is reviewed, edited and
          fact-checked by Waris Jamil before it&apos;s published.
        </p>
      ),
    },
    {
      id: "affiliate-links",
      title: "Affiliate links",
      body: (
        <p>
          We currently have no affiliate relationships. If that changes, affected pages will say
          so at the top.
        </p>
      ),
    },
    {
      id: "prices-and-examples",
      title: "Prices and agency examples",
      body: (
        <p>
          Prices and the agencies or platforms we use as examples are taken from public sources,
          and we link to them. No agency pays to be mentioned.
        </p>
      ),
    },
    {
      id: "guest-contributions",
      title: "Guest contributions",
      body: (
        <p>
          We don&apos;t accept guest posts yet. When we do, contributors will be named, guides will
          be reviewed by us before publishing, and paid or promotional submissions won&apos;t be
          accepted.
        </p>
      ),
    },
  ];

  return (
    <LegalPage
      title={TITLE}
      description={DESCRIPTION}
      path="/editorial-policy"
      updated={UPDATED}
      contactEmail={email}
      summary={[
        "Every guide names its author and shows when it was last updated.",
        "We check facts against primary sources and link to them.",
        "No one can pay to be mentioned in a guide, and advertisers have no say in what we write.",
        "If you find a mistake, tell us and we'll fix it.",
      ]}
      sections={sections}
    />
  );
}
