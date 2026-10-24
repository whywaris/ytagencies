"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { checkoutHref, perMonth, yearlySaving, type Period } from "@/lib/pricing";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

const card = "flex flex-col gap-2 rounded-[22px] p-7";
const btn =
  "inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-[15.5px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2";
const priceCls = "text-[40px] leading-tight font-[650] tracking-[-0.03em] tabular-nums";

function Feature({ on = true, children }: { on?: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-start gap-2.5", !on && "text-text-2")}>
      {on ? (
        <Check className="mt-[3px] size-4 shrink-0 [stroke-width:2.5] text-(--mint)" aria-hidden />
      ) : (
        <X className="mt-[3px] size-4 shrink-0 [stroke-width:2.5]" aria-hidden />
      )}
      <span>
        {!on && <span className="sr-only">Not included: </span>}
        {children}
      </span>
    </li>
  );
}

/**
 * Listing / Pro with the Monthly/Yearly toggle, which sets Pro's price and the
 * period "Get Pro" checks out with: always a Lemon Squeezy checkout created on the server
 * (app/dashboard/billing/checkout), or "temporarily unavailable" if Lemon Squeezy isn't set up.
 */
export function PlanCards({
  monthly,
  yearly,
  freeFeatures,
  proFeatures,
}: {
  monthly: number;
  yearly: number;
  /** lib/entitlements.ts freeFeatures(). */
  freeFeatures: string[];
  /** lib/entitlements.ts proFeatures(): what Pro adds, the same list the billing page shows. */
  proFeatures: string[];
}) {
  const [period, setPeriod] = useState<Period>("monthly");
  const saving = yearlySaving(monthly, yearly);

  return (
    <div className="flex flex-col items-center gap-8">
      <BillingToggle value={period} onChange={setPeriod} saving={saving} className="self-center" />
      <div className="mx-auto grid w-full max-w-[820px] items-stretch gap-4 text-left md:grid-cols-2">
        <section
          aria-labelledby="plan-listing"
          className={cn(card, "border border-line bg-raised")}
        >
          <h3 id="plan-listing" className="text-[18px] font-[650]">
            Free
          </h3>
          <p className={priceCls}>$0</p>
          <p className="text-[14.5px] text-text-2">
            Your agency on the pages that fit it. Claim it to edit your profile.
          </p>
          <ul className="my-5 grid gap-2.5 border-t border-line pt-5 text-[15px]">
            <Feature>Profile on matching service, industry and location pages</Feature>
            <Feature>Can earn the Verified badge</Feature>
            {freeFeatures.map((f) => (
              <Feature key={f}>{f}</Feature>
            ))}
            <Feature on={false}>Client contact details and replies</Feature>
          </ul>
          <Link
            href="/list-your-agency#claim"
            className={cn(
              btn,
              "mt-auto border border-line hover:border-text-2 focus-visible:outline-accent",
            )}
          >
            Add or claim your agency
          </Link>
        </section>

        <section
          aria-labelledby="plan-pro"
          className={cn(
            card,
            "relative border-2 border-accent bg-raised shadow-[0_1px_2px_rgba(20,25,40,.05),0_24px_48px_-20px_rgba(31,94,255,.35)] md:-my-3 md:py-10",
          )}
        >
          <p className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap text-on-accent">
            For agencies that want clients
          </p>
          <h3 id="plan-pro" className="text-[18px] font-[650]">
            Pro
          </h3>
          <p className={priceCls} aria-live="polite">
            {period === "monthly" ? usd(monthly) : usd(yearly)}
            <span className="text-[17px] font-normal text-text-2">
              {period === "monthly" ? " / month" : " / year"}
            </span>
          </p>
          <p className="text-[14.5px] text-text-2">
            {period === "monthly"
              ? "Billed monthly. Cancel anytime."
              : `Works out to ${perMonth(yearly)} a month. Billed yearly.`}
          </p>
          <p className="mt-5 border-t border-line pt-5 text-[14px] font-semibold">
            Everything in Free, plus
          </p>
          <ul className="mt-2 mb-5 grid gap-2.5 text-[15px]">
            {proFeatures.map((f) => (
              <Feature key={f}>{f}</Feature>
            ))}
          </ul>
          <div className="mt-auto">
            {/* A plain <a>: the checkout route creates a Lemon Squeezy session, so it's never prefetched. */}
            <a
              href={checkoutHref(period)}
              onClick={() =>
                track("checkout_start", { interval: period === "yearly" ? "year" : "month" })
              }
              className={cn(
                btn,
                "bg-accent text-on-accent hover:bg-(--accent-hover) focus-visible:outline-accent",
              )}
            >
              Get Pro
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Monthly / yearly, with the yearly saving. Shared by every place that sells Pro. */
export function BillingToggle({
  value,
  onChange,
  saving,
  className = "self-start",
}: {
  value: Period;
  onChange: (v: Period) => void;
  saving: number;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing"
      className={cn("inline-flex rounded-full border border-line bg-raised p-1", className)}
    >
      {(["monthly", "yearly"] as const).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          onClick={() => onChange(p)}
          className={cn(
            "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[14.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            value === p ? "bg-text text-bg" : "text-text-2 hover:text-text",
          )}
        >
          {p === "monthly" ? "Monthly" : "Yearly"}
          {p === "yearly" && saving > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[12px] font-semibold",
                value === p ? "bg-bg/20" : "bg-accent-soft text-(--accent-on-soft)",
              )}
            >
              Save {saving}%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
