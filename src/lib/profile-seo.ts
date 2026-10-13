// Agency profile SEO (docs/SEO.md "Agency profiles"): the generated meta title and description,
// and the thin-profile rule. Pure functions. No imports: tested.

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** "YouTube Ads" → "YouTube Ads Agency"; no service → "YouTube Agency". */
const agencyKind = (service: string | null) =>
  service ? `${service.replace(/\s+agency$/i, "")} Agency` : "YouTube Agency";

/**
 * "<Name>: <Main service> Agency for <Industry> | YT Agencies" when one industry has 40%+ of the
 * agency's focus, else "… Agency in <City> | YT Agencies". Too long: drop the brand, then the
 * for/in part. The agency name and service are never cut, even if that leaves it over 60.
 */
export function agencyTitle(t: {
  name: string;
  service: string | null;
  /** The industry with focus_pct ≥ 40, if any. */
  focusIndustry: string | null;
  city: string | null;
  brand: string;
}) {
  const base = `${t.name}: ${agencyKind(t.service)}`;
  const where = t.focusIndustry ? ` for ${t.focusIndustry}` : t.city ? ` in ${t.city}` : "";
  const candidates = [`${base}${where} | ${t.brand}`, `${base}${where}`, base];
  return candidates.find((c) => c.length <= TITLE_MAX) ?? base;
}

/**
 * Names mid-sentence: lowercased unless they contain a brand or acronym ("YouTube", "SEO", "SaaS").
 */
const inSentence = (s: string) =>
  s.split(/\s+/).some((w) => /[A-Z]/.test(w.slice(1))) ? s : s.toLowerCase();

/** "Influencer Marketing" → "influencer marketing"; "YouTube Ads" → "ads" (we add "YouTube"). */
const serviceWords = (service: string) => inSentence(service.replace(/^YouTube\s+/i, ""));

const UNIT: Record<string, string> = {
  retainer: "month",
  performance: "month",
  per_video: "video",
  project: "project",
};

function contractWords(v: string | null) {
  if (v === "none") return "no minimum contract";
  const m = v?.match(/^(\d+)_months?$/)?.[1];
  return m ? `${m}-month minimum` : null;
}

/**
 * "<Name> is a <City>-based YouTube <service> agency for <industry 1> and <industry 2> brands.
 * From $<price>/<unit>, <contract>. See channels, pricing and reviews." Missing parts are left out;
 * over 160 characters it drops the second industry, then shortens the last sentence (so it stays
 * in the 140–160 range where it can), then drops it.
 */
export function agencyDescription(d: {
  name: string;
  city: string | null;
  service: string | null;
  /** Industry names, most important first. */
  industries: string[];
  price: number | null;
  pricingModel: string | null;
  minContract: string | null;
}) {
  const where = d.city ? `${d.city}-based ` : "";
  const kind = d.service ? `YouTube ${serviceWords(d.service)} agency` : "YouTube agency";
  const forWho = (n: number) => {
    const list = d.industries.slice(0, n).map(inSentence);
    return list.length ? ` for ${list.join(" and ")} brands` : "";
  };
  // "an Austin-based", "a United States-based", "a YouTube …": by sound, not just the letter.
  const article = /^(?!uni|eu|one|use)[aeiou]/i.test(where || kind) ? "an" : "a";
  const lead = (n: number) => `${d.name} is ${article} ${where}${kind}${forWho(n)}.`;

  let price = "";
  if (d.price !== null) {
    const unit = d.pricingModel ? UNIT[d.pricingModel] : null;
    const contract = contractWords(d.minContract);
    price = ` From $${d.price.toLocaleString("en-US")}${unit ? `/${unit}` : ""}${contract ? `, ${contract}` : ""}.`;
  }
  const tail = " See channels, pricing and reviews.";
  const shortTail = " See pricing and reviews.";

  const candidates = [
    lead(2) + price + tail,
    lead(1) + price + tail,
    lead(1) + price + shortTail,
    lead(1) + price,
    lead(1),
  ];
  const fit = candidates.find((c) => c.length <= DESCRIPTION_MAX);
  if (fit) return fit;
  // A very long name: cut at a word boundary rather than mid-word.
  const cut = candidates[4].slice(0, DESCRIPTION_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/**
 * Thin profiles are noindex,follow and left out of the sitemap until they have: a description or
 * a "best for" line, at least 2 industries, and a starting price. Returns what's missing.
 */
export function thinProfileMissing(p: {
  hasDescription: boolean;
  hasBestFor: boolean;
  industries: number;
  hasPrice: boolean;
}) {
  const missing: string[] = [];
  if (!p.hasDescription && !p.hasBestFor) missing.push("a description or a “best for” line");
  if (p.industries < 2) missing.push("at least 2 industries");
  if (!p.hasPrice) missing.push("a starting price");
  return missing;
}
