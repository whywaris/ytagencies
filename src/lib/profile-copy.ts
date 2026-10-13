// Plain-sentence copy for the agency profile, built from the agency's own data on the server
// (no AI). Only facts we hold are stated; anything missing is left out. No imports: tested.

export type GlanceInput = {
  name: string;
  city: string | null;
  country: string | null;
  foundedYear: number | null;
  teamSize: string | null;
  /** Service names, most important first. */
  services: string[];
  /** Industry names, most important first. */
  industries: string[];
  startingPrice: number | null;
  pricingModel: string | null;
  minContract: string | null;
  adSpend: string | null;
  setupFee: number | null;
};

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/** "$3,000 per month on a monthly retainer" */
export function priceSentence(price: number, model: string | null) {
  switch (model) {
    case "retainer":
      return `${usd(price)} per month on a monthly retainer`;
    case "per_video":
      return `${usd(price)} per video`;
    case "project":
      return `${usd(price)} per project`;
    case "performance":
      return `${usd(price)} per month, performance-based`;
    default:
      return usd(price);
  }
}

/** "/mo", "/video", "/project", or "" */
export const unitSuffix = (model: string | null) =>
  model === "retainer" || model === "performance"
    ? "/mo"
    : model === "per_video"
      ? "/video"
      : model === "project"
        ? "/project"
        : "";

/** "a, b and c" */
export function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Names mid-sentence: "Influencer Marketing" → "influencer marketing", "E-commerce" → "e-commerce",
 * but names with a brand or acronym in them stay as they are ("YouTube Shorts", "SaaS").
 */
const lower = (s: string) =>
  s.split(/\s+/).some((w) => /[A-Z]/.test(w.slice(1))) ? s : s.toLowerCase();

function contractClause(v: string | null) {
  if (v === "none") return "with no minimum contract";
  const m = v?.match(/^(\d+)_months?$/)?.[1];
  return m ? `with a ${m}-month minimum` : null;
}

/** The "At a glance" paragraph. */
export function glance(g: GlanceInput) {
  const sentences: string[] = [];

  const where = g.city ? `${g.city}-based ` : "";
  const extras = [
    g.foundedYear ? `founded in ${g.foundedYear}` : null,
    g.teamSize ? `with ${g.teamSize.replace("-", "–")} people` : null,
  ].filter(Boolean);
  sentences.push(
    `${g.name} is a ${where}YouTube agency${extras.length ? ` ${extras.join(" ")}` : ""}.`,
  );

  if (g.services.length) {
    const top = list(g.services.slice(0, 3).map(lower));
    const forWho = g.industries.length
      ? `, mostly for ${list(g.industries.slice(0, 3).map(lower))} clients`
      : "";
    sentences.push(`It offers ${top}${forWho}.`);
  }

  if (g.startingPrice !== null) {
    const contract = contractClause(g.minContract);
    let s = `Pricing starts at ${priceSentence(g.startingPrice, g.pricingModel)}`;
    if (contract) s += ` ${contract}`;
    if (g.adSpend === "separate") s += "; ad spend is paid separately to Google";
    else if (g.adSpend === "included") s += "; ad spend is included";
    sentences.push(`${s}.`);
  }
  return sentences.join(" ");
}

export type FaqInput = GlanceInput & {
  /** [name, focus %] for industries, most important first. */
  industryFocus: { name: string; pct: number | null }[];
  /** Other locations they work in (not the HQ). */
  otherLocations: string[];
  /** "Usually replies within a day", if we have one. */
  replyLabel: string | null;
  replyCount: number | null;
};

/** Questions we can answer from data; a question without an answer is left out. */
export function faq(f: FaqInput) {
  const items: { question: string; answer: string }[] = [];

  if (f.startingPrice !== null) {
    let a = `Pricing starts at ${priceSentence(f.startingPrice, f.pricingModel)}`;
    if (f.setupFee) a += `, plus a ${usd(f.setupFee)} setup fee`;
    a += ".";
    if (f.adSpend === "separate") a += " Ad spend is paid separately to Google.";
    if (f.adSpend === "included") a += " Ad spend is included.";
    items.push({ question: `How much does ${f.name} charge?`, answer: a });
  }

  if (f.minContract) {
    const m = f.minContract.match(/^(\d+)_months?$/)?.[1];
    items.push({
      question: `Does ${f.name} require a contract?`,
      answer:
        f.minContract === "none"
          ? "No. There's no minimum contract."
          : m === "1"
            ? "Only a 1-month minimum, so you can stop month to month."
            : `Yes. There is a ${m}-month minimum.`,
    });
  }

  if (f.industryFocus.length) {
    const withPct = f.industryFocus.every((i) => i.pct !== null);
    const named = f.industryFocus
      .slice(0, 4)
      .map((i) => (withPct ? `${lower(i.name)} (${i.pct}%)` : lower(i.name)));
    items.push({
      question: `Which industries does ${f.name} work with?`,
      answer: `${withPct ? "Mostly" : "It works with"} ${list(named)}${withPct ? "." : " clients."}`,
    });
  }

  if (f.city || f.country) {
    const place = [f.city, f.country].filter(Boolean).join(", ");
    const also = f.otherLocations.length
      ? ` It also works with clients in ${list(f.otherLocations)}.`
      : "";
    items.push({ question: `Where is ${f.name} based?`, answer: `${place}.${also}` });
  }

  if (f.replyLabel && f.replyCount) {
    const how = f.replyLabel.replace(/^Usually replies /, "");
    items.push({
      question: `How fast does ${f.name} reply?`,
      answer: `Usually ${how}, based on ${f.replyCount} inquiries in the last 90 days.`,
    });
  }
  return items;
}
