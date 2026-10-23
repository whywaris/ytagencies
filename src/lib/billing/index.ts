import "server-only";

import { envValue, type Interval } from "@/lib/billing/events";
import { lemonSqueezy, lsConfig } from "@/lib/billing/lemonsqueezy";

export { lsConfig };
export type { Interval };

// Billing interface (ADMIN_V2_SPEC §6). Lemon Squeezy (merchant of record) implements it; nothing
// else in the app talks to the provider. Checkout is gated by PAYMENTS_ENABLED, which must be
// "true" (SECURITY.md), and by the provider's env being present. Webhooks are applied whenever the
// webhook secret is set, so existing subscriptions stay in sync even if checkout is switched off.

export const paymentsEnabled = () => envValue(process.env, "PAYMENTS_ENABLED") === "true";

export type BillingResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type Billing = {
  /** A checkout for Pro; returns the hosted checkout URL. */
  createCheckout(input: {
    agencyId: string;
    userId: string;
    email: string | null;
    interval: Interval;
    successUrl: string;
  }): Promise<BillingResult<{ url: string }>>;
  /** The customer portal: plan, card, cancel or resume, invoices. */
  portalUrl(customerId: string): Promise<BillingResult<{ url: string }>>;
};

/** "Get Pro" starts a checkout. */
export const checkoutAvailable = () => paymentsEnabled() && lsConfig() !== null;

const OFF = { ok: false as const, error: "Payments aren't enabled yet." };
const noop: Billing = {
  createCheckout: async () => OFF,
  portalUrl: async () => OFF,
};

/** The portal works for existing subscribers even if new checkouts are off. */
export const billing = (): Billing => (lsConfig() ? lemonSqueezy : noop);
