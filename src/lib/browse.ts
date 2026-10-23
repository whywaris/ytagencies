// /agencies: browse, search and filter every published agency. Pure, no imports: tests load this
// file directly. The page (app/(marketing)/agencies) feeds it the published agencies in the
// shared ranking order (rankAgencies, lib/ranking.ts), so "Recommended" keeps that order.

export const PAGE_SIZE = 20;
/** The page's one GET form; every field points at it with form="browse". */
export const BROWSE_FORM = "browse";
export const MAX_QUERY = 100;

/** "Your budget": an agency fits when its starting price is at or under the top of the range. */
export const BROWSE_BUDGETS = [
  { value: "under-1k", label: "Under $1k", max: 1000 },
  { value: "1k-3k", label: "$1k–3k", max: 3000 },
  { value: "3k-5k", label: "$3k–5k", max: 5000 },
  { value: "5k-10k", label: "$5k–10k", max: 10000 },
  { value: "10k-plus", label: "$10k+", max: Infinity },
] as const;
export type BudgetValue = (typeof BROWSE_BUDGETS)[number]["value"];

export const BROWSE_SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "price", label: "Lowest starting price" },
  { value: "newest", label: "Newest" },
] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number]["value"];

export type BrowseFilters = {
  q: string;
  services: string[];
  industry: string | null;
  country: string | null;
  budget: BudgetValue | null;
  pricing: string[];
  team: string | null;
  verified: boolean;
  sort: BrowseSort;
  page: number;
};

/** What the filters can be: the values that exist, so a hand-edited URL can't invent one. */
export type BrowseOptions = {
  services: string[];
  industries: string[];
  countries: string[];
  pricing: string[];
  teams: string[];
};

export type BrowseAgency = {
  id: string;
  name: string;
  isVerified: boolean;
  managed: boolean;
  minBudgetUsd: number | null;
  pricingModel: string | null;
  teamSize: string | null;
  createdAt: string;
  services: { slug: string; name: string }[];
  industries: { slug: string; name: string }[];
  /** Country slugs: the HQ's and every listed location's. */
  countries: string[];
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : [v ?? ""])
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
const known = (values: string[], allowed: string[]) => [
  ...new Set(values.filter((v) => allowed.includes(v))),
];

/** Search text: control characters and tsquery syntax stripped, spaces collapsed, 100 chars. */
export const cleanQuery = (raw: string) =>
  raw
    .replace(/[^A-Za-z0-9À-ɏ\s'&.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY)
    .trim();

/**
 * Words for a prefix tsquery ("you:* & ads:*"), letters and digits only so the query can't break
 * the to_tsquery syntax; null when there's nothing to search.
 */
export function prefixQuery(q: string) {
  const words = q
    .toLowerCase()
    .split(/[^a-z0-9À-ɏ]+/)
    .filter(Boolean)
    .slice(0, 8);
  return words.length ? words.map((w) => `${w}:*`).join(" & ") : null;
}

export function parseBrowse(params: Params, options: BrowseOptions): BrowseFilters {
  // The last value wins: a budget chip (a submit button) comes after the form's hidden current one.
  const budget = [params.budget ?? ""].flat().at(-1) ?? "";
  const sort = one(params.sort);
  const page = Number.parseInt(one(params.page), 10);
  const industry = one(params.industry);
  const country = one(params.country);
  const team = one(params.team);
  return {
    q: cleanQuery(one(params.q)),
    services: known(list(params.service), options.services),
    industry: options.industries.includes(industry) ? industry : null,
    country: options.countries.includes(country) ? country : null,
    budget: BROWSE_BUDGETS.some((b) => b.value === budget) ? (budget as BudgetValue) : null,
    pricing: known(list(params.pricing), options.pricing),
    team: options.teams.includes(team) ? team : null,
    verified: one(params.verified) === "1",
    sort: BROWSE_SORTS.some((s) => s.value === sort) ? (sort as BrowseSort) : "recommended",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The filters as a query string (defaults left out), for links, chips and the client form. */
export function browseQuery(f: Partial<BrowseFilters>) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.services?.length) p.set("service", f.services.join(","));
  if (f.industry) p.set("industry", f.industry);
  if (f.country) p.set("country", f.country);
  if (f.budget) p.set("budget", f.budget);
  if (f.pricing?.length) p.set("pricing", f.pricing.join(","));
  if (f.team) p.set("team", f.team);
  if (f.verified) p.set("verified", "1");
  if (f.sort && f.sort !== "recommended") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Any filter, search or sort (page alone doesn't count): noindex,follow, canonical /agencies. */
export const isFiltered = (f: BrowseFilters) =>
  !!(
    f.q ||
    f.services.length ||
    f.industry ||
    f.country ||
    f.budget ||
    f.pricing.length ||
    f.team ||
    f.verified ||
    f.sort !== "recommended"
  );

const FILTER_KEYS = [
  "q",
  "service",
  "industry",
  "country",
  "budget",
  "pricing",
  "team",
  "verified",
  "sort",
] as const;

/**
 * Indexing from the raw URL (generateMetadata runs before the options load): /agencies and
 * ?page=N are indexable and self-canonical; any filter, search or sort is noindex,follow with
 * the canonical on /agencies.
 */
export function browseRobots(params: Params) {
  const filtered = FILTER_KEYS.some((k) => list(params[k]).length > 0);
  const page = Number.parseInt(one(params.page), 10);
  if (filtered) return { noindex: true, canonical: "/agencies", page: 1 };
  const n = Number.isFinite(page) && page > 1 ? page : 1;
  return { noindex: false, canonical: n > 1 ? `/agencies?page=${n}` : "/agencies", page: n };
}

/** The filter keys in use, for the GA event (never the search text). */
export const usedFilterKeys = (f: BrowseFilters) =>
  [
    f.q && "q",
    f.services.length && "service",
    f.industry && "industry",
    f.country && "country",
    f.budget && "budget",
    f.pricing.length && "pricing",
    f.team && "team",
    f.verified && "verified",
  ].filter((k): k is string => typeof k === "string");

/** How many filters are on (the mobile "Filters (n)" button); search and sort aren't filters. */
export const filterCount = (f: BrowseFilters) =>
  f.services.length +
  Number(!!f.industry) +
  Number(!!f.country) +
  Number(!!f.budget) +
  f.pricing.length +
  Number(!!f.team) +
  Number(f.verified);

/**
 * Does the agency match? `searchIds` are the agencies whose `search` tsvector matched the query
 * (name, tagline, description); a query also matches an agency's service and industry names.
 * Agencies without a starting price only show when the budget is Any.
 */
export function matchesBrowse(
  a: BrowseAgency,
  f: BrowseFilters,
  searchIds: ReadonlySet<string> | null,
) {
  if (f.verified && !a.isVerified) return false;
  if (f.services.length && !a.services.some((s) => f.services.includes(s.slug))) return false;
  if (f.industry && !a.industries.some((i) => i.slug === f.industry)) return false;
  if (f.country && !a.countries.includes(f.country)) return false;
  if (f.budget) {
    const max = BROWSE_BUDGETS.find((b) => b.value === f.budget)!.max;
    if (a.minBudgetUsd === null || a.minBudgetUsd > max) return false;
  }
  if (f.pricing.length && !(a.pricingModel && f.pricing.includes(a.pricingModel))) return false;
  if (f.team && a.teamSize !== f.team) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const named = [...a.services, ...a.industries].some((t) => t.name.toLowerCase().includes(q));
    if (!named && !searchIds?.has(a.id)) return false;
  }
  return true;
}

/** Recommended keeps the incoming (merit) order; the others are stable sorts on top of it. */
export function sortBrowse<T extends BrowseAgency>(items: T[], sort: BrowseSort) {
  if (sort === "price")
    return [...items].sort((a, b) => (a.minBudgetUsd ?? Infinity) - (b.minBudgetUsd ?? Infinity));
  if (sort === "newest") return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}

/** Filter, sort and cut one page. A page past the end shows the last one. */
export function browse<T extends BrowseAgency>(
  ranked: T[],
  f: BrowseFilters,
  searchIds: ReadonlySet<string> | null,
) {
  const matched = sortBrowse(
    ranked.filter((a) => matchesBrowse(a, f, searchIds)),
    f.sort,
  );
  const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  return {
    total: matched.length,
    page,
    pages,
    items: matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  };
}

/** Numbered page links: first, last, and two either side of the current page, with gaps. */
export function pageNumbers(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2]);
  const out: (number | "gap")[] = [];
  for (let n = 1; n <= pages; n++) {
    if (!keep.has(n)) continue;
    const prev = out[out.length - 1];
    if (typeof prev === "number" && n - prev > 1) out.push("gap");
    out.push(n);
  }
  return out;
}

const fits = (candidates: string[], max: number) =>
  candidates.find((c) => c.length <= max) ?? candidates[candidates.length - 1];

/**
 * /agencies title (docs/SEO.md: ≤ 60 chars, the directory pages' "Best … (year)" pattern): the
 * head term people search, "YouTube marketing agencies", first. Page 2+ says which page.
 */
export function browseTitle(year: number, page: number, brand: string) {
  const p = page > 1 ? ` – Page ${page}` : "";
  return fits(
    [
      `Best YouTube Marketing Agencies (${year})${p} | ${brand}`,
      `Best YouTube Marketing Agencies (${year})${p}`,
      `YouTube Marketing Agencies${p}`,
    ],
    60,
  );
}

/** /agencies meta description: 140–160 chars, with the live agency count. */
export function browseDescription(n: number) {
  const count = new Intl.NumberFormat("en-US").format(n);
  return fits(
    [
      `Compare ${count} YouTube marketing agencies for ads, SEO, channel management, Shorts and video editing. See starting prices, niches and reviews. Free.`,
      `Compare ${count} YouTube marketing agencies for ads, SEO, channel management and Shorts. See starting prices, niches and reviews. Free.`,
      `Compare ${count} YouTube marketing agencies by service, niche and starting price. Free for businesses and creators.`,
    ],
    160,
  );
}
