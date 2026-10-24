"use client";

import { X } from "lucide-react";
import { useRef } from "react";

import { ChoosePro } from "@/components/forms/claim-form";
import { planComparison } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

// "Get Pro" in the dashboard header: Free listing vs Pro, then the same monthly/yearly choice as
// the paywall. A native <dialog>: focus moves in and back, Escape closes it.

// Free listing vs Pro from the entitlements (lib/entitlements.ts), as on /pricing and billing.
// "Yes"/"No" become a tick or a dash; "Profile on directory pages" is true for both.
const flag = (v: string) => (v === "Yes" ? true : v === "No" ? false : v);
const ROWS: [string, string | boolean, string | boolean][] = [
  ["Profile on directory pages", true, true],
  ...planComparison().map((r): [string, string | boolean, string | boolean] => [
    r.label,
    flag(r.free),
    flag(r.pro),
  ]),
];

type Props = React.ComponentProps<typeof ChoosePro> & {
  label?: string;
  className?: string;
  /** Yearly refund window (COMPANY.refunds, /refunds). */
  refundDays: number;
};

export function UpgradeDialog({ label = "Get Pro", className, refundDays, ...pro }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cell = (v: string | boolean, hl = false) => (
    <td className={cn("py-[11px] text-center", hl && "bg-(--accent-soft)")}>
      {v === true ? (
        <span className="font-bold text-(--mint)">
          ✓<span className="sr-only">Included</span>
        </span>
      ) : v === false ? (
        <span className="text-text-2">
          –<span className="sr-only">Not included</span>
        </span>
      ) : (
        v
      )}
    </td>
  );
  return (
    <>
      <button type="button" className={className} onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="upgrade-title"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto max-h-[calc(100vh-32px)] w-[min(720px,calc(100%-32px))] overflow-auto rounded-[24px] bg-raised p-6 text-text shadow-[0_1px_2px_rgba(0,0,0,.2),0_16px_40px_-12px_rgba(0,0,0,.5)] backdrop:bg-[rgba(16,18,24,.45)] md:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="upgrade-title" className="text-[24px] font-[650] tracking-[-0.025em]">
              See every client and reply with Pro
            </h2>
            <p className="mt-1.5 text-[15px] text-text-2">
              Free lets you edit your profile and see a preview of every request. Pro shows who sent
              it, so you can reply.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
            className="grid size-[34px] shrink-0 place-items-center rounded-full bg-surface"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <table className="mt-[18px] w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-line text-[13px]">
              <th scope="col" className="py-2.5 text-left">
                <span className="sr-only">Feature</span>
              </th>
              <th scope="col" className="w-[110px] py-2.5">
                Free
              </th>
              <th scope="col" className="w-[110px] bg-(--accent-soft) py-2.5">
                Pro
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, free, paid]) => (
              <tr key={label} className="border-b border-line-2">
                <th scope="row" className="py-[11px] text-left font-normal">
                  {label}
                </th>
                {cell(free)}
                {cell(paid, true)}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-5">
          <ChoosePro {...pro} />
        </div>
        <p className="mt-3.5 text-[12.5px] text-text-2">
          Monthly: cancel any time, Pro runs to the end of the month. Yearly: a full refund within
          {refundDays} days. The Verified badge can&apos;t be bought; it&apos;s given when our
          checks pass.
        </p>
      </dialog>
    </>
  );
}
