// Worldwide programmatic pages: places, "based here" vs "serves here", and copy built only from
// the agencies on a page. Pure, no imports: tests load this file directly.

/** URL slug from a place name: "São Paulo" → "sao-paulo". */
export const slugify = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

/**
 * A new city's slug. City slugs are global (/youtube-ads-agencies/in-<city>), so a name already
 * used elsewhere gets the country code: London, Canada → london-ca (then london-ca-2…).
 */
export function citySlug(name: string, countryIso: string, taken: ReadonlySet<string>) {
  const base = slugify(name);
  if (!base) return null;
  if (!taken.has(base)) return base;
  const withCountry = `${base}-${countryIso.toLowerCase()}`;
  if (!taken.has(withCountry)) return withCountry;
  for (let n = 2; n < 100; n++) if (!taken.has(`${withCountry}-${n}`)) return `${withCountry}-${n}`;
  return null;
}

/** City names as typed: 2–80 characters, no digits or symbols beyond . ' - (any script). */
export function cleanCityName(raw: string) {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return null;
  return /^[^\s\d.'’-][^\d!"#$%&()*+,/:;<=>?@[\\\]^_`{|}~]*$/.test(name) && slugify(name)
    ? name
    : null;
}

type Placed = { hqLocationId: number | null; locationIds: number[] };

/**
 * Who a place's page lists. Based there: the HQ is in the place (or one of its cities). Serves it
 * remotely: names the place (or a city in it) but is based elsewhere or has no HQ. A remote agency
 * is never shown as local; "serves worldwide" alone doesn't put an agency on a place's page.
 */
export function splitByPlace<T extends Placed>(items: T[], placeIds: ReadonlySet<number>) {
  const based: T[] = [];
  const remote: T[] = [];
  for (const a of items) {
    if (a.hqLocationId !== null && placeIds.has(a.hqLocationId)) based.push(a);
    else if (a.locationIds.some((id) => placeIds.has(id))) remote.push(a);
  }
  return { based, remote };
}

type FactsInput = {
  name: string;
  minBudgetUsd: number | null;
  pricingModel: string | null;
  isVerified: boolean;
  createdAt: string;
  services: { slug: string; name: string }[];
  industries: { slug: string; name: string }[];
};

const PRICING: Record<string, string> = {
  retainer: "a monthly retainer",
  per_video: "per video",
  project: "per project",
  performance: "performance-based pricing",
};

/** The same models as table labels. */
const PRICING_LABEL: Record<string, string> = {
  retainer: "Monthly retainer",
  per_video: "Per video",
  project: "Per project",
  performance: "Performance-based",
};

const usd = (n: number) => (n >= 1000 ? `$${Math.round(n / 100) / 10}k` : `$${n}`);

const top = (names: string[], n: number) =>
  [...names.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([name]) => name);

/** Facts about a page's agencies; anything there's no data for is left out (null or empty). */
export function pageFacts(items: FactsInput[]) {
  const prices = items.flatMap((a) => (a.minBudgetUsd === null ? [] : [a.minBudgetUsd]));
  const pricing = top(
    items.flatMap((a) => (a.pricingModel && PRICING[a.pricingModel] ? [a.pricingModel] : [])),
    1,
  )[0];
  const newest = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return {
    count: items.length,
    price: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    pricing: pricing ?? null,
    topIndustries: top(
      items.flatMap((a) => a.industries.map((i) => i.name)),
      3,
    ),
    topServices: top(
      items.flatMap((a) => a.services.map((s) => s.name)),
      3,
    ),
    verified: items.filter((a) => a.isVerified).length,
    newest: newest?.name ?? null,
  };
}

const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/**
 * A short intro from the page's own data, until an admin writes one (page_content). Only facts
 * that exist: no zero counts, no "0 verified", nothing made up.
 */
export function dataIntro(
  what: string,
  facts: ReturnType<typeof pageFacts>,
  skip: { industries?: boolean; services?: boolean } = {},
) {
  if (facts.count === 0) return "";
  const s: string[] = [
    `There ${facts.count === 1 ? "is 1 listing" : `are ${facts.count} listings`} for ${what}.`,
  ];
  if (facts.price)
    s.push(
      facts.price.min === facts.price.max
        ? `Starting prices are ${usd(facts.price.min)}.`
        : `Starting prices range from ${usd(facts.price.min)} to ${usd(facts.price.max)}.`,
    );
  if (facts.pricing) s.push(`Most charge ${PRICING[facts.pricing]}.`);
  if (!skip.services && facts.topServices.length)
    s.push(`The most offered services: ${list(facts.topServices)}.`);
  if (!skip.industries && facts.topIndustries.length)
    s.push(`They most often work with ${list(facts.topIndustries.map((i) => i.toLowerCase()))}.`);
  if (facts.verified) s.push(`${facts.verified} ${facts.verified === 1 ? "is" : "are"} Verified.`);
  if (facts.count > 1 && facts.newest) s.push(`The newest listing is ${facts.newest}.`);
  return s.join(" ");
}

/** "At a glance" rows for a page; rows with no data are left out. */
export function factRows(facts: ReturnType<typeof pageFacts>) {
  const rows: { label: string; value: string }[] = [];
  if (!facts.count) return rows;
  rows.push({ label: "Agencies listed", value: String(facts.count) });
  if (facts.price)
    rows.push({
      label: "Starting prices",
      value:
        facts.price.min === facts.price.max
          ? usd(facts.price.min)
          : `${usd(facts.price.min)}–${usd(facts.price.max)}`,
    });
  if (facts.pricing)
    rows.push({ label: "Most common pricing", value: PRICING_LABEL[facts.pricing] });
  if (facts.verified)
    rows.push({ label: "Verified", value: `${facts.verified} of ${facts.count}` });
  if (facts.newest && facts.count > 1) rows.push({ label: "Newest listing", value: facts.newest });
  return rows;
}

const fits = (candidates: string[], max: number) =>
  candidates.find((c) => c.length <= max) ?? candidates[candidates.length - 1];

/** Title (≤ 60): "Best YouTube Agencies for SaaS (2026) | YT Agencies", dropping parts when long. */
export const hubTitle = (subject: string, year: number, brand: string) =>
  fits(
    [
      `Best ${subject} (${year}) | ${brand}`,
      `Best ${subject} (${year})`,
      `Best ${subject}`,
      subject,
    ],
    60,
  );

/** Description (140–160 where the data allows), with the live count and starting prices. */
export function hubDescription(what: string, facts: ReturnType<typeof pageFacts>) {
  const n = facts.count;
  const price = facts.price ? ` Starting prices from ${usd(facts.price.min)}.` : "";
  return fits(
    [
      `Compare ${n} ${what} by service, starting price and reviews.${price} Free for businesses and creators.`,
      `Compare ${n} ${what} by service, starting price and reviews.${price}`,
      `Compare ${n} ${what}.${price}`,
    ],
    160,
  );
}
