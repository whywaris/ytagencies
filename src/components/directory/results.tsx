"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AgencyRow } from "@/components/directory/agency-row";
import { fieldClasses } from "@/components/ui/input";
import type { AgencyListItem } from "@/lib/data/agencies";
import { formatUsd } from "@/lib/directory";
import { cn } from "@/lib/utils";

const BUDGETS = [1000, 2500, 5000, 10000];
const TEAM_SIZES = ["1-10", "11-50", "51-200", "200+"];

type Filters = { budget?: number; size?: string; lang?: string };

function parseFilters(params: URLSearchParams, languages: string[]): Filters {
  const budget = Number(params.get("budget"));
  const size = params.get("size") ?? undefined;
  const lang = params.get("lang") ?? undefined;
  return {
    budget: BUDGETS.includes(budget) ? budget : undefined,
    size: size && TEAM_SIZES.includes(size) ? size : undefined,
    lang: lang && languages.includes(lang) ? lang : undefined,
  };
}

function matches(a: AgencyListItem, f: Filters) {
  // budget = what the visitor can spend: show agencies whose minimum fits under it.
  if (f.budget && (a.minBudgetUsd === null || a.minBudgetUsd > f.budget)) return false;
  if (f.size && a.teamSize !== f.size) return false;
  if (f.lang && !a.languages.includes(f.lang)) return false;
  return true;
}

type ResultsProps = { agencies: AgencyListItem[]; emptyHint: React.ReactNode };

/**
 * Reads filters from the URL. Static pages can't read searchParams on the server without going dynamic,
 * so this sits in a <Suspense> whose fallback is <ResultsView> with no filters: the full list stays in
 * the static HTML for crawlers, and filtering happens in the browser over data already on the page.
 */
export function Results(props: ResultsProps) {
  const params = useSearchParams();
  const languages = languagesOf(props.agencies);
  return <ResultsView {...props} filters={parseFilters(params, languages)} />;
}

function languagesOf(agencies: AgencyListItem[]) {
  return [...new Set(agencies.flatMap((a) => a.languages))].sort();
}

export function ResultsView({
  agencies,
  emptyHint,
  filters = {},
}: ResultsProps & { filters?: Filters }) {
  const router = useRouter();
  const pathname = usePathname();
  const languages = languagesOf(agencies);
  const shown = agencies.filter((a) => matches(a, filters));
  const active = Object.values(filters).some(Boolean);

  function setFilter(key: keyof Filters, value: string) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, [key]: value || undefined })) {
      if (v) next.set(k, String(v));
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (agencies.length === 0) {
    return <div className="rounded-lg bg-surface p-6">{emptyHint}</div>;
  }

  const selectClass = cn(fieldClasses, "w-full sm:w-48");

  return (
    <div className="flex flex-col gap-6">
      <form
        aria-label="Filter agencies"
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(e) => e.preventDefault()}
      >
        <FilterSelect
          label="Budget"
          value={filters.budget?.toString() ?? ""}
          onChange={(v) => setFilter("budget", v)}
          className={selectClass}
          options={BUDGETS.map((b) => ({ value: String(b), label: `Up to ${formatUsd(b)}` }))}
          anyLabel="Any budget"
        />
        <FilterSelect
          label="Team size"
          value={filters.size ?? ""}
          onChange={(v) => setFilter("size", v)}
          className={selectClass}
          options={TEAM_SIZES.map((s) => ({ value: s, label: `${s} people` }))}
          anyLabel="Any size"
        />
        {languages.length > 1 && (
          <FilterSelect
            label="Language"
            value={filters.lang ?? ""}
            onChange={(v) => setFilter("lang", v)}
            className={selectClass}
            options={languages.map((l) => ({ value: l, label: l }))}
            anyLabel="Any language"
          />
        )}
      </form>

      <p className="text-small" aria-live="polite">
        {active
          ? `Showing ${shown.length} of ${agencies.length} agencies`
          : `${agencies.length} ${agencies.length === 1 ? "agency" : "agencies"}`}
      </p>

      {shown.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {shown.map((agency) => (
            <li key={agency.id}>
              <AgencyRow agency={agency} />
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-lg bg-surface p-6">
          <p>
            No agencies match these filters yet.{" "}
            {filters.budget
              ? "Try removing the budget filter."
              : "Try removing a filter to see more agencies."}
          </p>
          <Link href={pathname} replace scroll={false} className="min-h-11 py-2 text-accent">
            Clear filters
          </Link>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  anyLabel,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  anyLabel: string;
  className: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[14px] font-medium">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
        <option value="">{anyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
