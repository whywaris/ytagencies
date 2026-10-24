// Who manages a listing, and what that unlocks. Pure rules with no imports, so tests load this
// file directly; getEntitlements() in lib/data/entitlements.ts feeds it from the database.
//
// Listings are free and can exist without an owner. A claimed listing's owner edits the basics on
// Free; Pro ($29/month or $279/year) adds client details and replies, booking buttons, no similar
// agencies, unlimited case studies, analytics, the Pro badge and Pro placement. "Managed" means a
// live Pro subscription.

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
  /** A live Pro subscription. */
  managed: boolean;
  /** "pro" while managed, otherwise "none". */
  plan: "pro" | "none";
  /** Owners edit the basics (logo, copy, prices, services, industries, locations, website…) on any plan. */
  canEdit: boolean;
  /** Pro: a lead's contact details (name, email, website, channel, message) and replying. Free owners see a preview. */
  leadDetails: boolean;
  /** "Usually replies within …" and Mark as contacted (needs the contact details). */
  responseTime: boolean;
  /** Profiles not on Pro suggest similar agencies; Pro profiles don't. */
  showSimilarAgencies: boolean;
  /** Case studies an owner can add and the profile shows: 3 on Free, unlimited on Pro. */
  caseStudies: number;
  /** Work samples (YouTube videos) the profile shows and the owner can add: 3 on Free, 12 on Pro. */
  workSamples: number;
  /** Profile analytics history in the dashboard (Pro only). */
  analyticsDays: number;
  /** Calendly and WhatsApp buttons on the profile. */
  bookingButtons: boolean;
  /** YouTube channels on the profile (Pro only). */
  channels: boolean;
  /** The gold Pro badge and Pro placement in the directory (lib/ranking.ts). */
  proBadge: boolean;
  /** Sponsored slots (switched off unless SPONSORED_ENABLED, lib/ranking.ts). */
  canBuySponsored: boolean;
  /** Earned by verification, on any plan. Never bought, never combined with the Pro badge. */
  verifiedBadge: boolean;
};

/** Case studies on Free. */
export const FREE_CASE_STUDIES = 3;
/** Work samples on Free and on Pro. */
export const FREE_WORK_SAMPLES = 3;
export const PRO_WORK_SAMPLES = 12;

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
    canEdit: true,
    leadDetails: managed,
    responseTime: managed,
    showSimilarAgencies: !managed,
    caseStudies: managed ? Infinity : FREE_CASE_STUDIES,
    workSamples: managed ? PRO_WORK_SAMPLES : FREE_WORK_SAMPLES,
    analyticsDays: managed ? 365 : 0,
    bookingButtons: managed,
    channels: managed,
    proBadge: managed,
    canBuySponsored: managed,
    verifiedBadge: verificationApproved,
  };
}

/**
 * What a listing includes, from its entitlements: the billing page and the upgrade dialog show
 * every row with its value, /pricing lists each plan's `feature` lines. One list, so they never
 * disagree. Never promise leads, rankings or results here. Pro's first line leads.
 */
export function planIncludes(e: Entitlements) {
  const yes = (b: boolean) => (b ? "Yes" : "No");
  return [
    {
      label: "Client details on requests",
      value: e.leadDetails ? "Name, email and message; reply directly" : "Preview only",
      feature: e.leadDetails
        ? "See client details and reply to every request"
        : "Preview of every request sent to you (service, niche, budget, timeline)",
    },
    {
      label: "Edit your profile",
      value: yes(e.canEdit),
      feature: e.canEdit
        ? "Edit logo, description, prices, services, industries and locations"
        : null,
    },
    {
      label: "Case studies",
      value: e.caseStudies === Infinity ? "Unlimited" : `Up to ${e.caseStudies}`,
      feature: e.caseStudies === Infinity ? "Unlimited case studies" : `Up to ${e.caseStudies} case studies`,
    },
    {
      label: "Work samples (YouTube videos)",
      value: `Up to ${e.workSamples}`,
      feature: `Up to ${e.workSamples} work samples (YouTube videos you worked on)`,
    },
    {
      label: "Pro badge and placement",
      value: e.proBadge ? "Gold Pro badge, shown first in its group" : "No",
      feature: e.proBadge ? "Pro badge, and shown before free listings in the directory" : null,
    },
    {
      label: "Other agencies suggested on your profile",
      value: yes(e.showSimilarAgencies),
      feature: e.showSimilarAgencies ? null : "No other agencies suggested on your profile",
    },
    {
      label: "Booking buttons (Calendly, WhatsApp)",
      value: yes(e.bookingButtons),
      feature: e.bookingButtons
        ? "Direct booking buttons (Calendly link and WhatsApp) on your profile"
        : null,
    },
    {
      label: "YouTube channels on your profile",
      value: yes(e.channels),
      feature: e.channels ? "YouTube channels you work on, with live stats" : null,
    },
    {
      label: "Analytics",
      value: e.analyticsDays >= 365 ? "12 months" : "No",
      feature: e.analyticsDays >= 365 ? "12 months of profile analytics" : null,
    },
  ];
}

/** A live Pro listing's entitlements, and a free one's (for the plan tables). */
export const PRO_ENTITLEMENTS = entitlementsFor({
  subscriptions: [
    { plan_id: "pro", status: "active", starts_at: "2000-01-01T00:00:00Z", ends_at: null },
  ],
  verificationApproved: false,
});
export const FREE_ENTITLEMENTS = entitlementsFor({
  subscriptions: [],
  verificationApproved: false,
});

const features = (e: Entitlements) => planIncludes(e).flatMap((r) => (r.feature ? [r.feature] : []));
/** What Pro adds on top of Free (lines Free also has are left out): /pricing, billing, paywall. */
export const proFeatures = () => {
  const free = new Set(features(FREE_ENTITLEMENTS));
  return features(PRO_ENTITLEMENTS).filter((f) => !free.has(f));
};
/** Free's feature lines: /pricing. */
export const freeFeatures = () => features(FREE_ENTITLEMENTS);

/** Free vs Pro, row by row (the dashboard's upgrade dialog). */
export const planComparison = () => {
  const free = planIncludes(FREE_ENTITLEMENTS);
  return planIncludes(PRO_ENTITLEMENTS).map((pro, i) => ({
    label: pro.label,
    free: free[i].value,
    pro: pro.value,
  }));
};
