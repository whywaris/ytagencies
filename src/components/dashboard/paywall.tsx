import { Check } from "lucide-react";

import { ChoosePro } from "@/components/forms/claim-form";
import type { DashboardContext } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

// The one paywall (docs/mockups/agency-dashboard.html): the Overview's main card when the listing
// isn't on Pro, and what Profile, Inquiries, Channels, Case studies and Verification show
// instead of their content. Says what Pro unlocks; never a blurred or made-up number.

export const PRO_BENEFITS = [
  "Edit your profile, channels and case studies",
  "A contact form: inquiries go straight to you",
  "Get matched requests that fit your services",
  "Listed above unmanaged agencies",
  "A link to your website, tagged so you can track visits",
  "No other agencies suggested on your profile",
];

export function Paywall({
  ctx,
  unlocks,
  className,
}: {
  ctx: DashboardContext;
  /** What this section does once on Pro, e.g. "Answer inquiries from businesses." */
  unlocks?: string;
  className?: string;
}) {
  const { agency, lapsed, pro } = ctx;
  return (
    <section
      aria-labelledby="paywall-h"
      className={cn(
        "rounded-[18px] border border-transparent bg-[linear-gradient(135deg,var(--accent-soft),var(--violet-soft))] p-[22px] md:p-7",
        className,
      )}
    >
      <h2 id="paywall-h" className="text-[22px] font-[650] tracking-[-0.02em]">
        Manage {agency.name} with Pro
      </h2>
      <p className="mt-1.5 max-w-[40em] text-[15px] text-text-2">
        {[
          unlocks,
          lapsed
            ? "Your Pro plan has ended, so your listing is unmanaged. We've kept your details; renew to pick up where you left off."
            : "Your listing is public, but businesses can't contact you and editing is locked.",
        ]
          .filter(Boolean)
          .join(" ")}
      </p>
      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ul className="grid content-start gap-2.5 text-[14.5px]">
          {PRO_BENEFITS.map((b) => (
            <li key={b} className="flex gap-2.5">
              <Check
                className="mt-[3px] size-4 shrink-0 [stroke-width:2.5] text-(--mint)"
                aria-hidden
              />
              {b}
            </li>
          ))}
        </ul>
        <div className="rounded-2xl bg-raised p-5">
          <ChoosePro
            agencyId={agency.id}
            agencyUrl={pro.agencyUrl}
            monthly={pro.monthly}
            yearly={pro.yearly}
            saving={pro.saving}
            live={pro.checkout}
            from="billing"
          />
        </div>
      </div>
    </section>
  );
}
