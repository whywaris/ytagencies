import { PlanCards } from "@/components/pro-billing";
import { getPlanPrices } from "@/lib/data/placement";
import { freeFeatures, proFeatures } from "@/lib/entitlements";

// Free / Pro, on /pricing and /list-your-agency. Pro's prices come from the plans table and both
// feature lists from the entitlements (the billing page's list).

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

export async function PlanColumns() {
  const prices = await getProPrices();
  return (
    <PlanCards
      monthly={prices.monthly}
      yearly={prices.yearly}
      freeFeatures={freeFeatures()}
      proFeatures={proFeatures()}
    />
  );
}
