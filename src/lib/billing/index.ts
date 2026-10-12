import "server-only";

// Billing interface (ADMIN_V2_SPEC §6). Payments are off: the active implementation is a no-op
// that says so. A provider (Lemon Squeezy or Paddle) implements `Billing` later and replaces
// `noop` below; nothing else in the app should talk to the provider.
// Everything is gated by PAYMENTS_ENABLED, which must be exactly "true" (SECURITY.md).

export const paymentsEnabled = () => process.env.PAYMENTS_ENABLED === "true";

export type BillingResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type Billing = {
  /** Starts a checkout for an agency; returns the provider's checkout URL. */
  createCheckout(input: {
    agencyId: string;
    plan: "pro";
    interval: "month" | "year";
    returnUrl: string;
  }): Promise<BillingResult<{ url: string }>>;
  /** Verifies and applies a provider webhook (subscription created, renewed, cancelled…). */
  handleWebhook(request: Request): Promise<BillingResult<{ handled: boolean }>>;
  /** Cancels an agency's paid subscription at the end of the current period. */
  cancel(agencyId: string): Promise<BillingResult<null>>;
};

const OFF = { ok: false as const, error: "Payments aren't enabled yet." };

const noop: Billing = {
  createCheckout: async () => OFF,
  handleWebhook: async () => OFF,
  cancel: async () => OFF,
};

export const billing: Billing = noop;
