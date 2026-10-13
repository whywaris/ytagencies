import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { getLiveAuthors } from "@/lib/data/guides";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";
import { PAGE_UPDATED } from "@/lib/page-dates";

// How guides are written, checked and corrected, and where agency data comes from. The author
// list is live (authors with a published guide).
export const revalidate = 3600;

const UPDATED = PAGE_UPDATED["/editorial-policy"];
const TITLE = "Editorial policy";
const DESCRIPTION =
  "Who writes the YT Agencies guides, how facts are checked and corrected, where our agency data comes from, and why sponsors have no say in what we publish.";

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
          <p>Agencies can&apos;t pay to be written about or mentioned in a guide.</p>
        </>
      ),
    },
    {
      id: "how-we-check-facts",
      title: "How we check facts",
      body: (
        <>
          <p>
            We use primary sources wherever we can: platform documentation, the agencies themselves,
            and what we see in the directory. Figures that come from our directory, such as typical
            starting budgets, are calculated live from current listings and say so.
          </p>
          <p>
            When a guide gives a price range or a rule, it&apos;s based on what agencies publish or
            tell us at the time. Prices change, so each guide shows when it was last updated.
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
      id: "agency-data",
      title: "Where agency data comes from",
      body: (
        <>
          <ul>
            <li>
              <strong>Listings</strong> are submitted or claimed by the agencies themselves, and we
              review each new listing before it goes live.
            </li>
            <li>
              <strong>Verified badges</strong> are given after we check the agency&apos;s YouTube
              channels through the YouTube Data API and review its details.
            </li>
            <li>
              <strong>Reviews</strong> are checked by us before they&apos;re published.
            </li>
          </ul>
          <p>
            If a listing looks wrong, please <Link href="/contact?topic=report">report it</Link>.
          </p>
        </>
      ),
    },
    {
      id: "independence",
      title: "Independence from sponsors",
      body: (
        <p>
          Pro and sponsored places affect where an agency appears in the directory, as our{" "}
          <Link href="/disclosure">disclosure</Link> explains. They never affect what we write in
          our guides.
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
        "We check facts against primary sources and our own directory data.",
        "Agencies can't pay to be mentioned in a guide, and sponsors have no say in what we write.",
        "If you find a mistake, tell us and we'll fix it.",
      ]}
      sections={sections}
    />
  );
}
