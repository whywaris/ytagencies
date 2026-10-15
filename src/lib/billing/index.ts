import "server-only";

import { creem, creemConfig } from "@/lib/billing/creem";
import { envValue } from "@/lib/billing/creem-events";

export { creemConfig };

// Billing interface (ADMIN_V2_SPEC §6). Creem (merchant of record) implements it; nothing else in
// the app talks to Creem. Checkout is gated by PAYMENTS_ENABLED, which must be "true"
// (SECURITY.md), and by the Creem env being present. Webhooks are applied whenever the webhook
// secret is set, so existing subscriptions stay in sync even if checkout is switched off.

export const paymentsEnabled = () => envValue(process.env, "PAYMENTS_ENABLED") === "true";

export type BillingResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type Interval = "month" | "year";

export type Billing = {
  /** A Creem checkout for Pro; returns the hosted checkout URL. */
  createCheckout(input: {
    agencyId: string;
    userId: string;
    email: string | null;
    interval: Interval;
    successUrl: string;
  }): Promise<BillingResult<{ url: string }>>;
  /** The customer portal: card, cancel, invoices. */
  portalUrl(customerId: string): Promise<BillingResult<{ url: string }>>;
  /** Monthly → yearly on the same subscription (prorated now). */
  switchToYearly(subscriptionId: string): Promise<BillingResult<null>>;
  /** Undo a cancel scheduled for the period end. */
  resume(subscriptionId: string): Promise<BillingResult<null>>;
};

/** "Get Pro" starts a checkout (instead of the Request Pro form). */
export const checkoutAvailable = () => paymentsEnabled() && creemConfig() !== null;

const OFF = { ok: false as const, error: "Payments aren't enabled yet." };
const noop: Billing = {
  createCheckout: async () => OFF,
  portalUrl: async () => OFF,
  switchToYearly: async () => OFF,
  resume: async () => OFF,
};

/** Portal, switch and resume work for existing subscribers even if new checkouts are off. */
export const billing = (): Billing => (creemConfig() ? creem : noop);
