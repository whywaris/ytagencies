// Who manages a listing, and what that unlocks. Pure rules with no imports, so tests load this
// file directly; getEntitlements() in lib/data/entitlements.ts feeds it from the database.
//
// Listings are free and can exist without an owner. Managing one needs Pro ($29/month or
// $279/year). There's no free managed plan: everything without a live Pro subscription is
// "unmanaged" (still public, with the data we hold, but nobody to contact).

export type Subscription = {
  plan_id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  /** Cancelling at the end of the period: still managed until ends_at. */
  cancel_at_period_end?: boolean;
  /** Set while status is past_due. */
  past_due_since?: string | null;
};

/** Days a past-due Pro subscription stays managed while the payment is retried. */
export const PAST_DUE_GRACE_DAYS = 7;

export type Entitlements = {
  /** A live Pro subscription: someone at the agency manages the listing. */
  managed: boolean;
  /** "pro" while managed, otherwise "none". */
  plan: "pro" | "none";
  /** Inquiries: the profile's contact form, Get matched routing, lead and reminder emails. */
  contactForm: boolean;
  websiteLink: boolean;
  utmLinks: boolean;
  /** "Usually replies within …" and Mark as contacted. */
  responseTime: boolean;
  /** Unmanaged profiles point visitors to similar (managed) agencies instead. */
  showSimilarAgencies: boolean;
  /** Case studies shown; all of them either way (what an admin entered still shows). */
  caseStudies: number;
  /** Directory order after sponsored slots: managed above unmanaged. */
  listTier: "managed" | "unmanaged";
  /** Profile analytics history in the dashboard. */
  analyticsDays: number;
  canBuySponsored: boolean;
  /** Owners can edit their listing only while managed. */
  canEdit: boolean;
  /** Earned by verification, managed or not. */
  verifiedBadge: boolean;
};

/** The live Pro subscription at `now`, if any (see isManaged). */
export function liveSubscription<T extends Subscription>(subscriptions: T[], now = new Date()) {
  const t = now.getTime();
  const graceMs = PAST_DUE_GRACE_DAYS * 86_400_000;
  return (
    subscriptions.find((s) => {
      if (s.plan_id !== "pro" || new Date(s.starts_at).getTime() > t) return false;
      if (s.status === "active") return s.ends_at === null || new Date(s.ends_at).getTime() > t;
      if (s.status === "past_due")
        return !!s.past_due_since && t - new Date(s.past_due_since).getTime() < graceMs;
      return false;
    }) ?? null
  );
}

/**
 * Managed = an active Pro subscription in its dates (including one cancelling at the period end,
 * which keeps its ends_at), or a past-due one within the 7-day grace. Everything else is
 * unmanaged: expired, cancelled, past due for longer, not started yet, or no subscription.
 */
export const isManaged = (subscriptions: Subscription[], now = new Date()) =>
  liveSubscription(subscriptions, now) !== null;

export function entitlementsFor({
  subscriptions,
  verificationApproved,
  now = new Date(),
}: {
  subscriptions: Subscription[];
  verificationApproved: boolean;
  now?: Date;
}): Entitlements {
  const managed = isManaged(subscriptions, now);
  return {
    managed,
    plan: managed ? "pro" : "none",
    contactForm: managed,
    websiteLink: managed,
    utmLinks: managed,
    responseTime: managed,
    showSimilarAgencies: !managed,
    caseStudies: Infinity,
    listTier: managed ? "managed" : "unmanaged",
    analyticsDays: managed ? 365 : 30,
    canBuySponsored: managed,
    canEdit: managed,
    verifiedBadge: verificationApproved,
  };
}
