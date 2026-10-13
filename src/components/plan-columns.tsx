import { Check } from "lucide-react";
import Link from "next/link";

import { ProBilling } from "@/components/pro-billing";
import { checkoutAvailable } from "@/lib/billing";
import { getPlanPrices } from "@/lib/data/placement";
import { CONTACT_EMAIL } from "@/lib/site";
import { cn } from "@/lib/utils";

// Listing / Pro / Sponsored, as on /for-agencies/pricing and /list-your-agency. Prices come from
// the plans table; the Pro button starts checkout once payments are on, else Request Pro.

/** Sponsored slots are priced per page and arranged by hand for now. */
export const SPONSORED_FROM_USD = 49;
/** Fallbacks if the plans table can't be read: the launch prices. */
const PRO_MONTHLY_USD = 29;
const PRO_YEARLY_USD = 279;

export async function getProPrices() {
  const pro = (await getPlanPrices()).get("pro");
  return {
    monthly: Number(pro?.price_monthly ?? PRO_MONTHLY_USD),
    yearly: Number(pro?.price_yearly ?? PRO_YEARLY_USD),
  };
}

const btnLight =
  "inline-flex h-12 w-full items-center justify-center rounded-full border border-line bg-raised px-6 text-[15.5px] font-semibold hover:border-text-2";

export async function PlanColumns() {
  const prices = await getProPrices();
  return (
    <div className="grid items-start gap-4 text-left lg:grid-cols-3">
      <Plan
        name="Listing"
        price={<p className={priceCls}>Free</p>}
        sub="Listed by us or submitted by you. Businesses can find you, but can't contact you."
        features={[
          "Profile on the pages for your services, industries and locations",
          "Visitors are offered Get matched with agencies on Pro",
          "Can earn the Verified badge",
        ]}
        cta={
          <Link href="/list-your-agency/new" className={btnLight}>
            Add your agency
          </Link>
        }
      />
      <Plan
        name="Pro"
        featured
        price={
          <ProBilling monthly={prices.monthly} yearly={prices.yearly} live={checkoutAvailable()} />
        }
        sub="Manage your listing and receive inquiries."
        features={[
          "Edit your profile any time",
          "A contact form on your profile: inquiries go straight to you",
          "Requests from Get matched that fit your services",
          "Listed above unmanaged agencies",
          "A link to your website, tagged so you can track visits",
          "Your reply time on your profile",
          "Unlimited case studies and channels",
          "No other agencies suggested on your profile",
          "12 months of profile analytics",
        ]}
      />
      <Plan
        name="Sponsored"
        price={
          <p className={priceCls}>
            ${SPONSORED_FROM_USD}
            <small className="text-[15px] font-medium text-text-2">+/mo</small>
          </p>
        }
        sub="Per directory page."
        features={[
          "A top 3 spot on a page you choose",
          "Always labeled Sponsored",
          "For agencies on Pro with the Verified badge",
        ]}
        cta={
          <a href={`mailto:${CONTACT_EMAIL}?subject=Sponsored%20placement`} className={btnLight}>
            Contact us
          </a>
        }
      />
    </div>
  );
}

const priceCls = "text-[34px] leading-tight font-[650] tracking-[-0.03em] tabular-nums";

function Plan({
  name,
  price,
  sub,
  features,
  cta,
  featured = false,
}: {
  name: string;
  price: React.ReactNode;
  sub: string;
  features: string[];
  cta?: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <section
      aria-labelledby={`plan-${name}`}
      className={cn(
        "flex flex-col gap-1.5 rounded-[22px] bg-raised p-[26px]",
        featured
          ? "border-2 border-accent shadow-[0_1px_2px_rgba(20,25,40,.05),0_12px_32px_-12px_rgba(20,25,40,.16)]"
          : "border border-line",
      )}
    >
      <h3 id={`plan-${name}`} className="text-[18px] font-[650]">
        {name}
      </h3>
      <div className="mt-1.5">{price}</div>
      <p className="text-[13.5px] text-text-2">{sub}</p>
      <ul className="mt-4 mb-5 grid gap-2.5 border-t border-line-2 pt-4 text-[14.5px]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check
              className="mt-[3px] size-4 shrink-0 [stroke-width:2.5] text-(--mint)"
              aria-hidden
            />
            {f}
          </li>
        ))}
      </ul>
      {cta && <div className="mt-auto">{cta}</div>}
    </section>
  );
}
