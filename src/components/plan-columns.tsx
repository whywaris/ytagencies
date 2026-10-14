import { PlanCards } from "@/components/pro-billing";
import { checkoutAvailable } from "@/lib/billing";
import { getPlanPrices } from "@/lib/data/placement";
import { proFeatures } from "@/lib/entitlements";

// Listing / Pro / Sponsored, on /pricing and /list-your-agency. Pro's prices come from the plans
// table and its features from the entitlements (the billing page's list). Sponsored has no
// public price: it's arranged by email ("Contact us").

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
      live={checkoutAvailable()}
      proFeatures={proFeatures()}
    />
  );
}
