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
    analyticsDays: managed ? 365 : 30,
    canBuySponsored: managed,
    canEdit: managed,
    verifiedBadge: verificationApproved,
  };
}

/**
 * What a listing includes, from its entitlements: the billing page shows every row with its
 * value, the pricing page lists Pro's `feature` lines. One list, so the two never disagree.
 */
export function planIncludes(e: Entitlements) {
  const yes = (b: boolean) => (b ? "Yes" : "No");
  return [
    {
      label: "Edit your listing",
      value: yes(e.canEdit),
      feature: e.canEdit ? "Edit your profile any time" : null,
    },
    {
      label: "Contact form and inquiries",
      value: yes(e.contactForm),
      feature: e.contactForm
        ? "A contact form on your profile: inquiries go straight to you"
        : null,
    },
    {
      label: "Requests from Get matched",
      value: yes(e.managed),
      feature: e.managed ? "Requests from Get matched that fit your services" : null,
    },
    {
      label: "Link to your website",
      value: e.websiteLink ? "Yes, tagged so you can track visits" : "No",
      feature: e.websiteLink ? "A link to your website, tagged so you can track visits" : null,
    },
    {
      label: "Your reply time on your profile",
      value: yes(e.responseTime),
      feature: e.responseTime ? "Your reply time on your profile" : null,
    },
    {
      label: "Visitors can contact you from your profile",
      value: yes(e.contactForm),
      feature: e.contactForm
        ? "Your profile can be contacted. Free listings send visitors to other agencies."
        : null,
    },
    {
      label: "Other agencies suggested on your profile",
      value: yes(e.showSimilarAgencies),
      feature: e.showSimilarAgencies ? null : "No other agencies suggested on your profile",
    },
    {
      label: "Analytics history",
      value: e.analyticsDays >= 365 ? "12 months" : "30 days",
      feature: e.analyticsDays >= 365 ? "12 months of profile analytics" : null,
    },
  ];
}

/** Pro's feature lines for the pricing page (a live Pro subscription's entitlements). */
export const proFeatures = () =>
  planIncludes(
    entitlementsFor({
      subscriptions: [
        { plan_id: "pro", status: "active", starts_at: "2000-01-01T00:00:00Z", ends_at: null },
      ],
      verificationApproved: false,
    }),
  ).flatMap((r) => (r.feature ? [r.feature] : []));
