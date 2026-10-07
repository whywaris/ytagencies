import Link from "next/link";

import { AgencyLogo } from "@/components/agency-logo";
import { Badge } from "@/components/ui/badge";
import type { AgencyListItem } from "@/lib/data/agencies";
import { minBudgetLabel } from "@/lib/directory";

// DESIGN.md agency row: one row per agency, 1px line border, 16px radius, no shadow, border darkens on hover.
export function AgencyRow({ agency }: { agency: AgencyListItem }) {
  const budget = minBudgetLabel(agency.minBudgetUsd, agency.pricingModel);
  const meta = [
    agency.industries
      .slice(0, 3)
      .map((i) => i.name)
      .join(", "),
    agency.rating &&
      `★ ${agency.rating.average.toFixed(1)} (${agency.rating.count} ${agency.rating.count === 1 ? "review" : "reviews"})`,
    agency.hq?.name,
  ].filter(Boolean);

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-line p-4 transition-colors duration-150 ease-out hover:border-text-2 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <div className="flex min-w-0 flex-1 gap-4">
        <AgencyLogo name={agency.name} logoPath={agency.logoPath} />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-h3">
              <Link href={`/agency/${agency.slug}`} className="hover:underline">
                {agency.name}
              </Link>
            </h3>
            {agency.sponsored && <Badge variant="sponsored">Sponsored</Badge>}
            {agency.isVerified && <Badge variant="verified">✓ Verified</Badge>}
            {agency.foundingBadge && <Badge>Founding agency</Badge>}
          </div>
          {agency.tagline && <p className="text-text-2">{agency.tagline}</p>}
          {meta.length > 0 && <p className="text-small">{meta.join(" · ")}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-6 sm:flex-col sm:items-end sm:gap-1">
        {budget && <p className="font-medium whitespace-nowrap">{budget}</p>}
        <Link
          href={`/agency/${agency.slug}`}
          aria-label={`View ${agency.name} profile`}
          className="flex min-h-11 items-center whitespace-nowrap text-accent hover:underline"
        >
          View profile
        </Link>
      </div>
    </article>
  );
}
