// Pricing details and response time: values, labels and thresholds shared by the forms, the
// profile, directory rows and the home hero. No imports: tested.

/** The units a starting price can be in (agencies.pricing_model, agency_services.price_unit). */
export const PRICING_MODELS = ["retainer", "per_video", "project", "performance"] as const;

export const MIN_CONTRACTS = ["none", "1_month", "3_months", "6_months", "12_months"] as const;
export type MinContract = (typeof MIN_CONTRACTS)[number];
export const AD_SPENDS = ["separate", "included", "not_applicable"] as const;
export type AdSpend = (typeof AD_SPENDS)[number];

/** Form options. */
export const MIN_CONTRACT_OPTION: Record<MinContract, string> = {
  none: "No minimum",
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "12_months": "12 months",
};
export const AD_SPEND_OPTION: Record<AdSpend, string> = {
  separate: "Paid separately by the client (to Google)",
  included: "Included in our price",
  not_applicable: "Not applicable (no ad spend)",
};

/** Profile "Pricing" block. null when unknown. */
export function contractLabel(v: string | null) {
  if (v === "none") return "No minimum contract";
  const months = v?.match(/^(\d+)_months?$/)?.[1];
  return months ? `${months}-month minimum` : null;
}

/** null when unknown or not applicable (production work has no ad spend). */
export function adSpendLabel(v: string | null) {
  if (v === "separate") return "Ad spend paid separately to Google";
  if (v === "included") return "Ad spend included";
  return null;
}

/** "No lock-in" chip: no minimum or month to month. */
export const noLockIn = (v: string | null) => v === "none" || v === "1_month";

/** Directory "Contract" filter. */
export const CONTRACT_FILTERS = {
  "no-lock-in": { label: "No lock-in", test: noLockIn },
  "3-months": {
    label: "Up to 3 months",
    test: (v: string | null) => noLockIn(v) || v === "3_months",
  },
} as const;

/**
 * "Usually replies within …" from the median minutes between an inquiry and the agency marking
 * it contacted (agency_response_times: 3+ contacted leads in 90 days). null when slower than 2 days.
 */
export function responseLabel(medianMinutes: number | null) {
  if (medianMinutes === null) return null;
  if (medianMinutes < 4 * 60) return "Usually replies within a few hours";
  if (medianMinutes < 24 * 60) return "Usually replies within a day";
  if (medianMinutes < 48 * 60) return "Usually replies within 2 days";
  return null;
}

/** "Save 20%": yearly against twelve months. */
export const yearlySaving = (monthly: number, yearly: number) =>
  Math.round((1 - yearly / (monthly * 12)) * 100);

export type Period = "monthly" | "yearly";

/** Where "Get Pro" goes for the selected period: sign-in if needed, then the agency's checkout
 * (app/dashboard/billing), or List your agency when the account has no agency yet. */
export const checkoutHref = (period: Period) =>
  `/dashboard/billing?interval=${period === "yearly" ? "year" : "month"}`;

/** "$23.25": a yearly price as a monthly amount. */
export const perMonth = (yearly: number) => {
  const m = Math.round((yearly / 12) * 100) / 100;
  return `$${Number.isInteger(m) ? m : m.toFixed(2)}`;
};
