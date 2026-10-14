"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AgencyCard } from "@/components/directory/agency-card";
import { fieldClasses } from "@/components/ui/input";
import type { AgencyListItem } from "@/lib/data/agencies";
import { formatUsd, sortAgencies, type Sort } from "@/lib/directory";
import { CONTRACT_FILTERS } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const BUDGETS = [1000, 2500, 5000, 10000];
const TEAM_SIZES = ["1-10", "11-50", "51-200", "200+"];

type ContractFilter = keyof typeof CONTRACT_FILTERS;
const CONTRACTS = Object.keys(CONTRACT_FILTERS) as ContractFilter[];

type Filters = {
  budget?: number;
  size?: string;
  lang?: string;
  contract?: ContractFilter;
  /** From the home finder (?industry=): no visible field; "Clear filters" removes it. */
  industry?: string;
  sort?: Sort;
};

const SORTS: { value: Sort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "budget", label: "Lowest minimum budget" },
];

function parseFilters(params: URLSearchParams, languages: string[], industries: string[]): Filters {
  const budget = Number(params.get("budget"));
  const size = params.get("size") ?? undefined;
  const lang = params.get("lang") ?? undefined;
  const contract = params.get("contract") as ContractFilter | null;
  const industry = params.get("industry");
  return {
    industry: industry && industries.includes(industry) ? industry : undefined,
    sort: params.get("sort") === "budget" ? "budget" : undefined,
    contract: contract && CONTRACTS.includes(contract) ? contract : undefined,
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
  if (f.contract && !CONTRACT_FILTERS[f.contract].test(a.minContract)) return false;
  if (f.industry && !a.industries.some((i) => i.slug === f.industry)) return false;
  return true;
}

type ResultsProps = {
  agencies: AgencyListItem[];
  emptyHint: React.ReactNode;
  /** This page's service slug: highlighted on each card. */
  highlight?: string;
};

/**
 * Reads filters from the URL. Static pages can't read searchParams on the server without going dynamic,
 * so this sits in a <Suspense> whose fallback is <ResultsView> with no filters: the full list stays in
 * the static HTML for crawlers, and filtering happens in the browser over data already on the page.
 */
export function Results(props: ResultsProps) {
  const params = useSearchParams();
  const languages = languagesOf(props.agencies);
  const industries = [...new Set(props.agencies.flatMap((a) => a.industries.map((i) => i.slug)))];
  return <ResultsView {...props} filters={parseFilters(params, languages, industries)} />;
}

function languagesOf(agencies: AgencyListItem[]) {
  return [...new Set(agencies.flatMap((a) => a.languages))].sort();
}

export function ResultsView({
  agencies,
  emptyHint,
  highlight,
  filters = {},
}: ResultsProps & { filters?: Filters }) {
  const router = useRouter();
  const pathname = usePathname();
  const languages = languagesOf(agencies);
  const shown = sortAgencies(
    agencies.filter((a) => matches(a, filters)),
    filters.sort ?? "recommended",
  );
  const active = !!(
    filters.budget ||
    filters.size ||
    filters.lang ||
    filters.contract ||
    filters.industry
  );
  const industryName = agencies
    .flatMap((a) => a.industries)
    .find((i) => i.slug === filters.industry)?.name;

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

  const selectClass = cn(fieldClasses, "w-full");

  return (
    <div className="flex flex-col gap-6">
      <form
        aria-label="Filter agencies"
        className="flex flex-wrap items-end gap-3 lg:flex-nowrap"
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
        <FilterSelect
          label="Contract"
          value={filters.contract ?? ""}
          onChange={(v) => setFilter("contract", v)}
          className={selectClass}
          options={CONTRACTS.map((c) => ({ value: c, label: CONTRACT_FILTERS[c].label }))}
          anyLabel="Any"
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
        <label className="flex w-full shrink-0 flex-col gap-1 text-[14px] font-medium sm:ml-auto sm:w-auto">
          Sort
          <select
            value={filters.sort ?? "recommended"}
            onChange={(e) => setFilter("sort", e.target.value === "budget" ? "budget" : "")}
            className={cn(fieldClasses, "w-full sm:w-52")}
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </form>

      <p className="text-small" aria-live="polite">
        {active
          ? `Showing ${shown.length} of ${agencies.length} agencies${industryName ? ` for ${industryName}` : ""}`
          : `${agencies.length} ${agencies.length === 1 ? "agency" : "agencies"}`}
        {active && shown.length > 0 && (
          <>
            {" · "}
            <Link href={pathname} replace scroll={false} className="text-accent hover:underline">
              Show all
            </Link>
          </>
        )}
      </p>

      {shown.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {shown.map((agency) => (
            <li key={agency.id}>
              <AgencyCard agency={agency} highlight={highlight} />
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
    <label className="flex w-full min-w-0 flex-col gap-1 text-[14px] font-medium sm:w-40 lg:w-auto lg:flex-1">
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
