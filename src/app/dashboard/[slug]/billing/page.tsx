import Link from "next/link";

import { Button } from "@/components/ui/button";
import { openBillingPortal, startCheckout } from "@/lib/actions/billing";
import { dashboardContext } from "@/lib/data/dashboard";
import { getPlanPrices } from "@/lib/data/placement";
import { liveSubscription, planIncludes } from "@/lib/entitlements";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata = { title: "Billing" };

const ERRORS: Record<string, string> = {
  unavailable: `Checkout is temporarily unavailable. Email ${CONTACT_EMAIL}`,
  checkout: "We couldn't start the checkout. Please try again in a minute.",
  portal: "We couldn't open your subscription. Please try again in a minute, or email us.",
};
const STATUS: Record<string, string> = {};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
// The button has no outline variant; the secondary look, from the same tokens.
const outline =
  "border border-line bg-transparent text-text hover:border-text-2 hover:bg-transparent";
const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export default async function BillingPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[slug]/billing">) {
  // Owner only (404 otherwise); every plan state renders.
  const { agency, supabase, e } = await dashboardContext((await params).slug);
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const [subs, prices] = await Promise.all([
    // Owners read their own subscriptions (RLS).
    supabase
      .from("agency_subscriptions")
      .select(
        "plan_id, status, starts_at, ends_at, cancel_at_period_end, past_due_since, source, billing_interval, customer_id, created_at",
      )
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false }),
    getPlanPrices(),
  ]);
  if (subs.error) throw new Error("Couldn't load billing");
  const live = liveSubscription(subs.data);
  const lastPaid = subs.data.find((s) => s.source === "payment" && s.customer_id);
  const pro = prices.get("pro");
  const monthly = Number(pro?.price_monthly ?? 29);
  const yearly = Number(pro?.price_yearly ?? 279);
  const saving = Math.round((1 - yearly / (monthly * 12)) * 100);
  const lapsed = !live && subs.data.length > 0;

  const error = ERRORS[one(sp.error) ?? ""];
  const status =
    one(sp.status) === "success"
      ? e.managed
        ? "Payment received. You're on Pro."
        : "Payment received. Pro turns on as soon as Lemon Squeezy confirms it, usually within a minute. Refresh this page to check."
      : STATUS[one(sp.status) ?? ""];
  const preferred = one(sp.interval) === "year" ? "year" : "month";

  const includes = planIncludes(e);

  let summary: string;
  if (!live)
    summary = lapsed
      ? "Your Pro plan has ended. Your profile stays public with the details we hold, but businesses can't contact you and editing is locked."
      : "Your listing is unmanaged: your profile is public, but businesses can't contact you and editing is locked.";
  else if (live.status === "past_due")
    summary = `Your last payment didn't go through. Pro stays on until ${fmt(new Date(Date.parse(live.past_due_since!) + 7 * 86_400_000).toISOString())} while Lemon Squeezy retries it. Update your card in Manage subscription.`;
  else if (live.cancel_at_period_end && live.ends_at) summary = `Ends on ${fmt(live.ends_at)}.`;
  else if (live.source === "manual")
    summary = live.ends_at
      ? `Granted by us until ${fmt(live.ends_at)}.`
      : "Granted by us, no end date.";
  else summary = live.ends_at ? `Renews on ${fmt(live.ends_at)}.` : "Renews automatically.";

  const intervalLabel =
    live?.billing_interval === "year"
      ? "Yearly"
      : live?.billing_interval === "month"
        ? "Monthly"
        : null;

  return (
    <div className="flex flex-col gap-12">
      {(error || status) && (
        <p
          role={error ? "alert" : "status"}
          className={
            error
              ? "max-w-reading rounded-lg border border-destructive px-4 py-3 text-destructive"
              : "max-w-reading rounded-lg border border-line bg-surface px-4 py-3"
          }
        >
          {error ?? status}
        </p>
      )}

      <section aria-labelledby="plan" className="flex max-w-reading flex-col gap-4">
        <h2 id="plan" className="text-h2">
          {live ? `Pro${intervalLabel ? `, ${intervalLabel.toLowerCase()}` : ""}` : "No plan"}
        </h2>
        <p className="text-text-2">{summary}</p>

        {live?.source === "payment" ? (
          <div className="flex flex-wrap gap-3">
            {/* Lemon Squeezy's customer portal: switch to yearly, update the card, cancel or
                resume, invoices. */}
            <form action={openBillingPortal.bind(null, agency.id)}>
              <Button type="submit">Manage subscription</Button>
            </form>
            <p className="basis-full text-small">
              {live.cancel_at_period_end
                ? "Changed your mind? Resume Pro in Manage subscription."
                : live.billing_interval === "month" && saving > 0
                  ? `Switch to yearly in Manage subscription and save ${saving}%.`
                  : "Change your plan, card or invoices in Manage subscription."}
            </p>
          </div>
        ) : !live ? (
          // Always the checkout; if Lemon Squeezy isn't set up, the action comes back with "unavailable".
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              {(["month", "year"] as const).map((i) => (
                <form key={i} action={startCheckout.bind(null, agency.id, i, "billing")}>
                  <Button type="submit" className={i === preferred ? undefined : outline}>
                    {i === "month"
                      ? `Get Pro, ${usd(monthly)} a month`
                      : `Get Pro, ${usd(yearly)} a year${saving > 0 ? ` (save ${saving}%)` : ""}`}
                  </Button>
                </form>
              ))}
            </div>
            <p className="text-small">
              Secure checkout by Lemon Squeezy, our payment provider. Cancel any time.{" "}
              <Link href="/refunds" className="text-accent hover:underline">
                Refund policy
              </Link>
            </p>
          </div>
        ) : null}

        {!live?.customer_id && lastPaid && (
          <form action={openBillingPortal.bind(null, agency.id)}>
            <Button type="submit" variant="link" className="px-0">
              Past invoices
            </Button>
          </form>
        )}
      </section>

      <section aria-labelledby="includes" className="flex max-w-reading flex-col gap-4">
        <h2 id="includes" className="text-h3">
          What your listing has now
        </h2>
        <dl className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {includes.map(({ label, value }) => (
            <div key={label} className="flex min-h-11 items-center justify-between gap-4 px-4 py-2">
              <dt className="text-text-2">{label}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <Link href="/pricing" className="self-start text-accent hover:underline">
          Pricing and what Pro includes
        </Link>
      </section>
    </div>
  );
}
