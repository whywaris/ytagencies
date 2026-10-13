"use client";

import { ListFilter } from "lucide-react";
import { Popover } from "radix-ui";

import { usePortalContainer } from "@/components/admin/portal";

type Option = { value: string; label: string };

export type FilterValues = {
  claimed: string;
  verified: string;
  plan: string;
  service: string;
  industry: string;
};

const selectCls = "h-9 w-full rounded-lg border border-line bg-bg px-2";

/**
 * Filter menu for the agencies table (§5.2). A plain GET form: filters live in the URL, so the
 * server does the filtering and results can be shared or bookmarked.
 */
export function AgencyFilters({
  values,
  keep,
  services,
  industries,
}: {
  values: FilterValues;
  /** Other params to carry along (search, status tab, sort). */
  keep: Record<string, string>;
  services: Option[];
  industries: Option[];
}) {
  const container = usePortalContainer();
  const active = Object.values(values).filter(Boolean).length;
  const field = (name: keyof FilterValues, label: string, options: Option[]) => (
    <label className="flex flex-col gap-1">
      <span className="text-admin-meta">{label}</span>
      <select name={name} defaultValue={values[name]} className={selectCls}>
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const yesNo = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ];

  return (
    <Popover.Root>
      <Popover.Trigger className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 transition-colors duration-150 hover:bg-surface-2">
        <ListFilter className="size-4 [stroke-width:1.5] text-text-2" aria-hidden />
        Filters
        {active > 0 && (
          <span className="rounded-md bg-surface-2 px-1.5 text-[12px] font-medium num">
            {active}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-xl border border-line bg-bg p-4 text-text shadow-lg outline-none"
        >
          <form method="get" action="/admin/agencies" className="flex flex-col gap-3">
            {Object.entries(keep).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            {field("claimed", "Claimed", yesNo)}
            {field("verified", "Verified", yesNo)}
            {field("plan", "Plan", [
              { value: "free", label: "Free" },
              { value: "pro", label: "Pro" },
            ])}
            {field("service", "Service", services)}
            {field("industry", "Industry", industries)}
            <div className="mt-1 flex items-center justify-between">
              <a
                href={`/admin/agencies?${new URLSearchParams(keep)}`}
                className="text-text-2 hover:text-text hover:underline"
              >
                Clear filters
              </a>
              <button
                type="submit"
                className="h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90"
              >
                Apply
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
