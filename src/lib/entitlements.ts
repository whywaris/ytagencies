// Plan entitlements (ADMIN_V2_SPEC §6). Pure rules with no imports, so tests load this file
// directly; getEntitlements() in lib/data/entitlements.ts feeds it from the database.

export type PlanId = "free" | "founding" | "pro";

export type Subscription = {
  plan_id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
};

export type Entitlements = {
  /** The plan in effect right now. */
  plan: PlanId;
  /** Max case studies on the profile; Infinity = unlimited. */
  caseStudies: number;
  websiteLink: boolean;
  showSimilarAgencies: boolean;
  matchPriority: "normal" | "high";
  /** Directory order after sponsored slots: paid (Founding/Pro) above Free. */
  listTier: "paid" | "free";
  analyticsDays: number;
  utmLinks: boolean;
  canBuySponsored: boolean;
  /** Only with an approved verification, on any plan. */
  verifiedBadge: boolean;
  /** Forever, once an agency has been a Founding agency. */
  foundingBadge: boolean;
};

/** The plan in effect at `now`: the active subscription whose dates cover it, else Free. */
export function currentPlan(subscriptions: Subscription[], now = new Date()): PlanId {
  const t = now.getTime();
  const live = subscriptions.find(
    (s) =>
      s.status === "active" &&
      new Date(s.starts_at).getTime() <= t &&
      (s.ends_at === null || new Date(s.ends_at).getTime() > t),
  );
  return live?.plan_id === "founding" || live?.plan_id === "pro" ? live.plan_id : "free";
}

export function entitlementsFor({
  subscriptions,
  verificationApproved,
  now = new Date(),
}: {
  /** Every subscription row the agency has had (any status), for the Founding badge. */
  subscriptions: Subscription[];
  verificationApproved: boolean;
  now?: Date;
}): Entitlements {
  const plan = currentPlan(subscriptions, now);
  const paid = plan !== "free"; // Founding gets Pro entitlements while it lasts
  return {
    plan,
    caseStudies: paid ? Infinity : 2,
    websiteLink: paid,
    showSimilarAgencies: !paid,
    matchPriority: paid ? "high" : "normal",
    listTier: paid ? "paid" : "free",
    analyticsDays: paid ? 365 : 30,
    utmLinks: paid,
    canBuySponsored: paid,
    verifiedBadge: verificationApproved,
    foundingBadge: subscriptions.some(
      (s) => s.plan_id === "founding" && new Date(s.starts_at).getTime() <= now.getTime(),
    ),
  };
}
