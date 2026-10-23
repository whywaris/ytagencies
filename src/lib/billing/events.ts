// Provider-neutral subscription rules: how a billing event changes an agency's Pro row
// (agency_subscriptions). Pure, no imports: tests load this file directly. The provider adapter
// (lib/billing/lemonsqueezy-events.ts) turns its webhook events into a Change.

export type Interval = "month" | "year";

export type Change = {
  /** The provider's subscription id (agency_subscriptions.external_id). */
  subscriptionId: string;
  /** From our checkout custom data, when present. */
  agencyId: string | null;
  customerId: string | null;
  interval: Interval | null;
  /** End of the current period (renewal date, or the end date once cancelled), ISO. */
  periodEnd: string | null;
  kind: "activate" | "update" | "scheduled_cancel" | "paid" | "past_due" | "end";
  /** For kind "update": whether it's still set to cancel at the period end (resumed = false). */
  cancelAtPeriodEnd?: boolean;
  /** For kind "end": how it ended. */
  endStatus?: "cancelled" | "expired";
};

export type SubRow = {
  status: "active" | "past_due" | "expired" | "cancelled";
  starts_at: string;
  ends_at: string | null;
  cancel_at_period_end: boolean;
  past_due_since: string | null;
  billing_interval: Interval | null;
  customer_id: string | null;
  last_event_at: string | null;
};

export type Email = "welcome" | "payment_failed" | "ended";

const LIVE = new Set(["active", "past_due"]);

/**
 * The subscription row after a change, and the email it calls for. Null when there's nothing to
 * write: an event older than the last one applied (retries arrive out of order), or a change to
 * a subscription we never saw start, or one that already ended.
 */
export function nextRow(
  current: SubRow | null,
  change: Change,
  at: Date,
): { row: SubRow; email: Email | null; created: boolean } | null {
  const iso = at.toISOString();
  if (current?.last_event_at && at.getTime() < Date.parse(current.last_event_at)) return null;
  if (!current && change.kind !== "activate" && change.kind !== "scheduled_cancel") return null;

  const base: SubRow = current ?? {
    status: "active",
    starts_at: iso,
    ends_at: null,
    cancel_at_period_end: false,
    past_due_since: null,
    billing_interval: null,
    customer_id: null,
    last_event_at: null,
  };
  const live = current ? LIVE.has(current.status) : false;
  const common = {
    billing_interval: change.interval ?? base.billing_interval,
    customer_id: change.customerId ?? base.customer_id,
    last_event_at: iso,
  };
  // ends_at must be after starts_at (table check); a period end before it is ignored.
  const endsAt = (end: string | null) =>
    end && Date.parse(end) > Date.parse(base.starts_at) ? end : base.ends_at;

  switch (change.kind) {
    case "activate":
      return {
        row: {
          ...base,
          ...common,
          status: "active",
          ends_at: endsAt(change.periodEnd),
          cancel_at_period_end: false,
          past_due_since: null,
        },
        email: live ? null : "welcome",
        created: !current,
      };
    case "scheduled_cancel":
      if (current && !live) return null;
      return {
        row: {
          ...base,
          ...common,
          status: "active",
          ends_at: endsAt(change.periodEnd),
          cancel_at_period_end: true,
          past_due_since: null,
        },
        email: current ? null : "welcome",
        created: !current,
      };
    case "update":
      if (!live) return null;
      return {
        row: {
          ...base,
          ...common,
          ends_at: endsAt(change.periodEnd),
          // Renewed or resumed: no longer cancelling (a cancel arrives as scheduled_cancel).
          cancel_at_period_end: change.cancelAtPeriodEnd ?? base.cancel_at_period_end,
        },
        email: null,
        created: false,
      };
    case "paid":
      // A renewal or retry went through: back to active, the grace period over. The new period
      // end comes with the subscription update that follows.
      if (!live) return null;
      return {
        row: { ...base, ...common, status: "active", past_due_since: null },
        email: null,
        created: false,
      };
    case "past_due":
      if (!live) return null;
      return {
        row: {
          ...base,
          ...common,
          status: "past_due",
          past_due_since: base.past_due_since ?? iso,
        },
        email: base.status === "past_due" ? null : "payment_failed",
        created: false,
      };
    case "end":
      if (!live) return null;
      return {
        row: {
          ...base,
          ...common,
          status: change.endStatus ?? "cancelled",
          // Ends now; null if "now" isn't after the start (the status alone ends it).
          ends_at: at.getTime() > Date.parse(base.starts_at) ? iso : null,
          cancel_at_period_end: false,
          past_due_since: null,
        },
        email: "ended",
        created: false,
      };
  }
}

/**
 * An env value as typed in Vercel, without the stray spaces, line breaks or wrapping quotes a
 * paste can bring along (a "true " would otherwise leave checkout off).
 */
export function envValue(env: Record<string, string | undefined>, name: string) {
  return (env[name] ?? "")
    .trim()
    .replace(/^(["'])([^]*)\1$/, "$2")
    .trim();
}
