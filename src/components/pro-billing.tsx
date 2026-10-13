"use client";

import Link from "next/link";
import { useState } from "react";

import { RequestProForm } from "@/components/forms/request-pro-form";
import { cn } from "@/lib/utils";

const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

// Pro's price with a monthly/yearly toggle, and its button: "Get Pro" opens the Request Pro form
// while payments are off.
export function ProBilling({
  monthly,
  yearly,
  live,
}: {
  monthly: number;
  yearly: number;
  live: boolean;
}) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const saving = Math.round((1 - yearly / (monthly * 12)) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="Billing"
        className="inline-flex self-start rounded-full border border-line p-1"
      >
        {(["monthly", "yearly"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => setPeriod(p)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium",
              period === p ? "bg-text text-bg" : "text-text-2 hover:text-text",
            )}
          >
            {p === "monthly" ? "Monthly" : "Yearly"}
            {p === "yearly" && saving > 0 && (
              <span className={cn("text-[12px]", period === p ? "" : "text-accent")}>
                Save {saving}%
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="text-h2" aria-live="polite">
        {period === "monthly" ? usd(monthly) : usd(yearly)}
        <span className="text-[17px] font-normal text-text-2">
          {period === "monthly" ? " a month" : " a year"}
        </span>
      </p>
      {live ? (
        <Link
          href="/login?next=/dashboard"
          className="inline-flex h-11 items-center self-start rounded-full bg-accent px-5 font-semibold text-on-accent"
        >
          Get Pro
        </Link>
      ) : (
        <RequestProForm period={period} />
      )}
    </div>
  );
}
