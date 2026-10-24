import { BadgeCheck, MapPin, Shapes, Users } from "lucide-react";
import Link from "next/link";

import { AgencyLogo } from "@/components/agency-logo";
import { ProBadge } from "@/components/pro-badge";
import { Badge } from "@/components/ui/badge";
import type { AgencyListItem } from "@/lib/data/agencies";
import { cardActions, formatUsd, priceSuffix, pricingName } from "@/lib/directory";
import { contractLabel } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const icon = "size-4 shrink-0 text-text-2 [stroke-width:1.5]";

// Directory card: who the agency is on the left, what it costs and how to reach it on the right
// (under the info on mobile). Empty fields are left out, never shown as "N/A".
export function AgencyCard({
  agency: a,
  highlight,
}: {
  agency: AgencyListItem;
  /** This page's service: its chip goes first, in blue. */
  highlight?: string;
}) {
  const services = [
    ...a.services.filter((s) => s.slug === highlight),
    ...a.services.filter((s) => s.slug !== highlight),
  ].slice(0, 2);
  const industries = a.industries
    .slice(0, 2)
    .map((i) => i.name)
    .join(", ");
  const terms = [pricingName(a.pricingModel), contractLabel(a.minContract)].filter(Boolean);

  return (
    <article
      className={cn(
        "flex flex-col gap-5 rounded-lg border border-line p-5 transition-[border-color,box-shadow] duration-150 ease-out hover:border-accent/40 hover:shadow-[0_8px_24px_-12px_rgba(20,25,40,.18)] md:flex-row md:gap-6 md:p-6",
        a.sponsored && "bg-surface",
      )}
    >
      <div className="flex min-w-0 flex-1 gap-4">
        <AgencyLogo name={a.name} logoPath={a.logoPath} />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-h3">
              <Link href={`/agency/${a.slug}`} className="hover:underline">
                {a.name}
              </Link>
            </h3>
            {a.isVerified && (
              <Badge variant="verified">
                <BadgeCheck aria-hidden />
                Verified
              </Badge>
            )}
            {a.managed && <ProBadge />}
            {a.sponsored && <Badge variant="sponsored">Sponsored</Badge>}
          </div>
          {a.tagline && <p className="line-clamp-1 text-text-2">{a.tagline}</p>}
          {services.length > 0 && (
            <ul aria-label="Services" className="flex flex-wrap gap-1.5">
              {services.map((s) => (
                <li
                  key={s.slug}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[14px]",
                    s.slug === highlight
                      ? "bg-accent-soft text-(--accent-on-soft)"
                      : "bg-surface text-text-2",
                  )}
                >
                  {s.name}
                </li>
              ))}
            </ul>
          )}
          {(a.hq || a.teamSize || industries) && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small">
              {a.hq && (
                <li className="flex items-center gap-1.5">
                  <MapPin className={icon} aria-hidden />
                  {a.hq.name}
                </li>
              )}
              {a.teamSize && (
                <li className="flex items-center gap-1.5">
                  <Users className={icon} aria-hidden />
                  {a.teamSize} people
                </li>
              )}
              {industries && (
                <li className="flex items-center gap-1.5">
                  <Shapes className={icon} aria-hidden />
                  {industries}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4 md:w-52 md:shrink-0 md:items-end md:border-0 md:pt-0 md:text-right">
        {a.minBudgetUsd !== null && (
          <div className="flex flex-col md:items-end">
            <span className="text-small">Starting at</span>
            <span className="text-h3 font-semibold num">
              {formatUsd(a.minBudgetUsd)}
              <span className="text-[15px] font-normal text-text-2">
                {priceSuffix(a.pricingModel)}
              </span>
            </span>
            {terms.length > 0 && <span className="text-small">{terms.join(" · ")}</span>}
          </div>
        )}
        {a.minBudgetUsd === null && terms.length > 0 && (
          <span className="text-small">{terms.join(" · ")}</span>
        )}
        <div className="flex flex-wrap gap-2 md:mt-auto md:justify-end">
          {cardActions(a).map((act) => (
            <Link
              key={act.label}
              href={act.href}
              aria-label={`${act.label}: ${a.name}`}
              className={cn(
                "inline-flex h-10 items-center justify-center rounded-full px-4 text-[15px] font-medium whitespace-nowrap transition-colors duration-150",
                act.primary
                  ? "bg-accent text-on-accent hover:bg-(--accent-hover)"
                  : "border border-line hover:border-text-2",
              )}
            >
              {act.label}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
