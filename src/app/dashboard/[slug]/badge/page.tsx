import Image from "next/image";

import { BadgeCode } from "@/components/dashboard/badge-code";
import { badgeCode, card, cardSub, cardTitle } from "@/components/dashboard/ui";
import { BADGES, type BadgeKind } from "@/lib/badge-svg";
import { dashboardContext } from "@/lib/data/dashboard";

export const metadata = { title: "Badge" };

// Free for every claimed listing: "Listed on"; verified agencies (any plan) also get "Verified on".
// Both link to the agency's profile.
export default async function BadgePage({ params }: PageProps<"/dashboard/[slug]/badge">) {
  const { agency, e } = await dashboardContext((await params).slug);
  const kinds: BadgeKind[] = e.verifiedBadge ? ["verified", "listed"] : ["listed"];
  return (
    <section aria-labelledby="badge-h" className={`${card} max-w-reading`}>
      <h2 id="badge-h" className={cardTitle}>
        Show it on your website
      </h2>
      <p className={cardSub}>
        Add a badge to your site so clients can see your profile.
        {!e.verifiedBadge && " Once you're verified, you also get the Verified badge."}
      </p>
      {kinds.map((kind) => (
        <div key={kind} className="mt-5 flex flex-col">
          <Image
            src={BADGES[kind].path}
            alt={BADGES[kind].label}
            width={BADGES[kind].width}
            height={40}
            unoptimized
          />
          {agency.status === "published" ? (
            <BadgeCode code={badgeCode(agency.slug, kind)} />
          ) : (
            <p className="mt-3 text-[13.5px] text-text-2">
              The code appears once your listing is live.
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
