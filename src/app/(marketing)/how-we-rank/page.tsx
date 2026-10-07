import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { MAX_SPONSORED } from "@/lib/ranking";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, MIN_AGENCIES_TO_INDEX } from "@/lib/site";

export const revalidate = 3600;

// Public explanation of lib/ranking.ts (ADMIN_V2_SPEC §6). Change both together.

export const metadata = buildMetadata({
  title: `How we rank agencies | ${BRAND_NAME}`,
  description:
    "How YT Agencies orders agencies on directory pages: sponsored placements, then paid plans, then free listings, each sorted by profile quality, reviews and verification.",
  path: "/how-we-rank",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "How we rank agencies", path: "/how-we-rank" },
];

export default function HowWeRankPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <article className="mx-auto flex max-w-reading flex-col gap-12 px-4 py-12 md:py-20">
        <div className="flex flex-col gap-8">
          <Breadcrumbs items={breadcrumbs} />
          <header className="flex flex-col gap-4">
            <h1 className="text-h1">How we rank agencies</h1>
            <p className="text-text-2">
              Every directory page lists agencies in the same order. Paid placement is always
              labeled, and nobody can pay to change their reviews or their Verified badge.
            </p>
          </header>
        </div>

        <section aria-labelledby="order" className="flex flex-col gap-4">
          <h2 id="order" className="text-h2">
            The order on a page
          </h2>
          <ol className="flex list-decimal flex-col gap-3 pl-6">
            <li>
              <strong>Sponsored.</strong> Up to {MAX_SPONSORED} agencies can sponsor a page. They
              appear first, in the order of their slot, and carry a Sponsored label. Only agencies
              on a paid plan (Founding or Verified) with the Verified badge can sponsor a page.
            </li>
            <li>
              <strong>Agencies on a paid plan.</strong> Founding and Verified agencies come next.
            </li>
            <li>
              <strong>Free listings.</strong> Everyone else.
            </li>
          </ol>
          <p>
            Within groups 2 and 3, agencies are sorted by a quality score from 0 to 100, highest
            first. Agencies with the same score are listed alphabetically.
          </p>
        </section>

        <section aria-labelledby="score" className="flex flex-col gap-4">
          <h2 id="score" className="text-h2">
            The quality score
          </h2>
          <h3 className="text-h3">Complete profile: up to 40 points</h3>
          <ul className="flex list-disc flex-col gap-1 pl-6">
            <li>Logo: 5</li>
            <li>Tagline: 5</li>
            <li>Description: 10 for 200 characters or more, 5 for at least 50</li>
            <li>Minimum budget: 5</li>
            <li>At least one case study: 10</li>
            <li>At least one location: 5</li>
          </ul>
          <h3 className="text-h3">Reviews: up to 30 points</h3>
          <p>
            Only reviews we&apos;ve checked and published count: 1.5 points per review, up to 10
            reviews, plus up to 15 points for the average rating.
          </p>
          <h3 className="text-h3">Verification: up to 30 points</h3>
          <p>
            30 points when we&apos;ve verified the agency and checked its YouTube channel stats, 15
            when it was verified before channel stats were recorded. Channel stats are re-checked
            every month.
          </p>
        </section>

        <section aria-labelledby="not" className="flex flex-col gap-4">
          <h2 id="not" className="text-h2">
            What doesn&apos;t affect ranking
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-6">
            <li>How many inquiries an agency has received.</li>
            <li>Whether an agency has claimed its listing.</li>
            <li>Anything an agency pays us, except a labeled Sponsored slot or a paid plan.</li>
          </ul>
          <p className="text-text-2">
            Pages need {MIN_AGENCIES_TO_INDEX} published agencies before search engines index them.
            Agencies can see what each plan includes on our{" "}
            <Link href="/for-agencies/pricing" className="text-accent hover:underline">
              pricing page
            </Link>
            .
          </p>
        </section>
      </article>
    </>
  );
}
