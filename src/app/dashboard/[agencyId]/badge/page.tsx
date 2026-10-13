import Image from "next/image";

import { BadgeCode } from "@/components/dashboard/badge-code";
import { badgeCode, card, cardSub, cardTitle } from "@/components/dashboard/ui";
import { dashboardContext } from "@/lib/data/dashboard";
import { BRAND_NAME } from "@/lib/site";

export const metadata = { title: "Badge" };

export default async function BadgePage({ params }: PageProps<"/dashboard/[agencyId]/badge">) {
  const { agency } = await dashboardContext((await params).agencyId);
  return (
    <section aria-labelledby="badge-h" className={`${card} max-w-reading`}>
      <h2 id="badge-h" className={cardTitle}>
        Show it on your website
      </h2>
      <p className={cardSub}>Add the badge to your site so clients can see your profile.</p>
      <Image
        src="/badge.svg"
        alt={`Listed on ${BRAND_NAME}`}
        width={180}
        height={40}
        className="mt-3"
        unoptimized
      />
      {agency.status === "published" ? (
        <BadgeCode code={badgeCode(agency.slug)} />
      ) : (
        <p className="mt-3 text-[13.5px] text-text-2">
          The code appears once your listing is live.
        </p>
      )}
    </section>
  );
}
