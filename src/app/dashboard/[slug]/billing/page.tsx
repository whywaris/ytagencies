import Link from "next/link";
import { notFound } from "next/navigation";

import { RequestProForm } from "@/components/forms/request-pro-form";
import { Button } from "@/components/ui/button";
import { keepPro, openBillingPortal, startCheckout, switchToYearly } from "@/lib/actions/billing";
import { getOwnedAgency } from "@/lib/auth";
import { checkoutAvailable } from "@/lib/billing";
import { getEntitlements } from "@/lib/data/entitlements";
import { getPlanPrices } from "@/lib/data/placement";
import { liveSubscription } from "@/lib/entitlements";
import { absoluteUrl } from "@/lib/site";

export const metadata = { title: "Billing" };

const ERRORS: Record<string, string> = {
  unavailable: "Online payments aren't available right now. Request Pro below and we'll set it up.",
  checkout: "We couldn't start the checkout. Please try again in a minute.",
  portal: "We couldn't open billing. Please try again in a minute, or email us.",
  switch: "We couldn't switch you to yearly. Please try again in a minute.",
  resume: "We couldn't keep your plan going. Please try again in a minute.",
};
const STATUS: Record<string, string> = {
  switched: "Switched to yearly. Your new renewal date shows here in a moment.",
  resumed: "Pro will renew as usual. It can take a moment to show here.",
};

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
  const owned = await getOwnedAgency((await params).slug);
  if (!owned) notFound();
  const { agency, supabase } = owned;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const [e, subs, prices] = await Promise.all([
    getEntitlements(agency.id),
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
  const canCheckout = checkoutAvailable();

  const error = ERRORS[one(sp.error) ?? ""];
  const status =
    one(sp.status) === "success"
      ? e.managed
        ? "Payment received. You're on Pro."
        : "Payment received. Pro turns on as soon as Creem confirms it, usually within a minute. Refresh this page to check."
      : STATUS[one(sp.status) ?? ""];
  const preferred = one(sp.interval) === "year" ? "year" : "month";

  const yes = (b: boolean) => (b ? "Yes" : "No");
  const includes: [string, string][] = [
    ["Edit your listing", yes(e.canEdit)],
    ["Contact form and inquiries", yes(e.contactForm)],
    ["Requests from Get matched", yes(e.managed)],
    ["Link to your website", e.websiteLink ? "Yes, tagged so you can track visits" : "No"],
    [
      "Placement on directory pages",
      e.listTier === "managed" ? "Above unmanaged agencies" : "Below managed agencies",
    ],
    ["Other agencies suggested on your profile", yes(e.showSimilarAgencies)],
    ["Analytics history", e.analyticsDays >= 365 ? "12 months" : "30 days"],
  ];

  let summary: string;
  if (!live)
    summary = lapsed
      ? "Your Pro plan has ended. Your profile stays public with the details we hold, but businesses can't contact you and editing is locked."
      : "Your listing is unmanaged: your profile is public, but businesses can't contact you and editing is locked.";
  else if (live.status === "past_due")
    summary = `Your last payment didn't go through. Pro stays on until ${fmt(new Date(Date.parse(live.past_due_since!) + 7 * 86_400_000).toISOString())} while Creem retries it. Update your card in Manage billing.`;
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
            {live.cancel_at_period_end && (
              <form action={keepPro.bind(null, agency.id)}>
                <Button type="submit">Keep Pro</Button>
              </form>
            )}
            {live.billing_interval === "month" &&
              live.status === "active" &&
              !live.cancel_at_period_end && (
                <form action={switchToYearly.bind(null, agency.id)}>
                  <Button type="submit">
                    Switch to yearly{saving > 0 ? `, save ${saving}%` : ""}
                  </Button>
                </form>
              )}
            <form action={openBillingPortal.bind(null, agency.id)}>
              <Button type="submit" className={outline}>
                Manage billing
              </Button>
            </form>
          </div>
        ) : !live ? (
          canCheckout ? (
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
                Secure checkout by Creem, our payment provider. Cancel any time.{" "}
                <Link href="/refunds" className="text-accent hover:underline">
                  Refund policy
                </Link>
              </p>
            </div>
          ) : (
            <RequestProForm
              agency={absoluteUrl(`/agency/${agency.slug}`)}
              period={preferred === "year" ? "yearly" : "monthly"}
            />
          )
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
          {includes.map(([k, v]) => (
            <div key={k} className="flex min-h-11 items-center justify-between gap-4 px-4 py-2">
              <dt className="text-text-2">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <Link href="/for-agencies/pricing" className="self-start text-accent hover:underline">
          Pricing and what Pro includes
        </Link>
      </section>
    </div>
  );
}
