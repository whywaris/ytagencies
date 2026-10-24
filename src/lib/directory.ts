import type { AgencyListItem } from "@/lib/data/agencies";
import type { Faq, Segment, Service } from "@/lib/data/taxonomy";

// Copy and SEO text for directory pages (docs/SEO.md patterns). Pure functions, no data access,
// type-only imports: tested (tests/directory.test.mjs).

/** "United States" → "the United States", for "in the United States". */
function withArticle(name: string) {
  return /^United /.test(name) ? `the ${name}` : name;
}

/** "for Doctors & clinics" / "in the United Kingdom" */
export function segmentPhrase(segment: Segment) {
  return segment.kind === "industry"
    ? `for ${segment.industry.name}`
    : `in ${withArticle(segment.location.name)}`;
}

export function segmentName(segment: Segment) {
  return segment.kind === "industry" ? segment.industry.name : segment.location.name;
}

/** H1: "Best YouTube Ads Agencies for Doctors" (docs/SEO.md). */
export function directoryHeading(service: Service, segment?: Segment) {
  return segment
    ? `Best ${service.name} Agencies ${segmentPhrase(segment)}`
    : `Best ${service.name} Agencies`;
}

/** First candidate that fits `max`; the last one otherwise. */
export function firstThatFits(candidates: string[], max: number) {
  return candidates.find((c) => c.length <= max) ?? candidates[candidates.length - 1];
}

/** Title ≤ 60 chars: "Best YouTube Ads Agencies for Doctors (2026) | Brand", dropping parts when long. */
export function directoryTitle(brand: string, service: Service, segment?: Segment) {
  const h1 = directoryHeading(service, segment);
  const year = new Date().getFullYear();
  const bare = segment
    ? `${service.name} Agencies ${segmentPhrase(segment)}`
    : `${service.name} Agencies`;
  return firstThatFits([`${h1} (${year}) | ${brand}`, `${h1} (${year})`, h1, bare], 60);
}

/** Description of 140–160 chars with the agency count, or the closest candidate. */
export function directoryDescription(service: Service, count: number, segment?: Segment) {
  const what = `${service.name} agencies${segment ? ` ${segmentPhrase(segment)}` : ""}`;
  const candidates =
    count === 0
      ? [
          `Find ${what}. We're adding agencies to this list now. Tell us what you need and we'll match you with agencies that fit your budget.`,
          `Find ${what}. We're adding agencies to this list now. Tell us what you need and we'll match you with agencies that fit.`,
          `Find ${what}. Tell us what you need and we'll match you.`,
        ]
      : [
          `Compare ${count} ${what}. See minimum budgets, specialties, case studies and reviews, then contact the agencies you like directly.`,
          // Short service names (hubs) land under 140 with the line above.
          `Compare ${count} ${what}. See minimum budgets, specialties, case studies and reviews, then contact the agencies you like directly. Free to use.`,
          `Compare ${count} ${what}: minimum budgets, specialties, case studies and reviews. Contact agencies directly, free.`,
          `Compare ${count} ${what} by budget, specialty and reviews. Free to use.`,
          `Compare ${count} ${what}.`,
        ];
  const distance = (s: string) => Math.max(140 - s.length, s.length - 160, 0);
  return candidates.reduce((best, c) => (distance(c) < distance(best) ? c : best));
}

const PRICING_SUFFIX: Record<string, string> = {
  retainer: "/mo",
  per_video: "/video",
  project: "/project",
  performance: "/mo",
};

/** "/mo", "/video", "/project", or "" when the pricing model isn't set. */
export const priceSuffix = (pricingModel: string | null) =>
  PRICING_SUFFIX[pricingModel ?? ""] ?? "";

/** 3000 → "$3k", 1500 → "$1.5k", 800 → "$800" */
export function formatUsd(n: number) {
  return n >= 1000 ? `$${Math.round(n / 100) / 10}k` : `$${n}`;
}

export function minBudgetLabel(minBudgetUsd: number | null, pricingModel: string | null) {
  if (minBudgetUsd === null) return null;
  return `From ${formatUsd(minBudgetUsd)}${PRICING_SUFFIX[pricingModel ?? ""] ?? ""}`;
}

/** Fallback "How to choose" copy until service_industry_content is written for the combo. */
export function defaultHowToChoose(service: Service, segment?: Segment) {
  const who =
    segment?.kind === "industry"
      ? `${segment.industry.name.toLowerCase()} clients`
      : "businesses like yours";
  return [
    `Start with fit. Ask each agency for ${service.name.toLowerCase()} case studies from ${who}, with real numbers such as cost per lead, return on ad spend or subscriber growth, and links to the channels.`,
    `Check the minimum budget against what you can spend each month for at least three months. Most YouTube work needs time to test and improve before results settle.`,
    `Ask how they report results and how often. Good agencies agree on one or two numbers that matter to your business before they start, and report on those rather than views alone.`,
  ];
}

/** The directory pages' "How are these agencies ranked?" answer (lib/ranking.ts). */
export const RANKING_ANSWER =
  "Pro agencies are shown first and always carry a Pro badge: Verified and Pro, then Pro, then Verified, then everyone else. Within each group, agencies are sorted by the same quality score. Verified is earned and can't be bought.";

/** FAQs built from the agencies on the page, used when no hand-written FAQs exist. A sentence
 * only appears when its data exists: no zero counts. */
export function defaultFaqs(
  service: Service,
  agencies: AgencyListItem[],
  segment?: Segment,
): Faq[] {
  return faqsFor(
    `${service.name} agencies${segment ? ` ${segmentPhrase(segment)}` : ""}`,
    agencies,
  );
}

/** Data-built FAQs for any directory page ("YouTube agencies for SaaS"): no zero counts. */
export function faqsFor(what: string, agencies: AgencyListItem[]): Faq[] {
  const faqs: Faq[] = [];

  const budgets = agencies.flatMap((a) => (a.minBudgetUsd === null ? [] : [a.minBudgetUsd]));
  if (budgets.length > 0) {
    const min = Math.min(...budgets);
    const max = Math.max(...budgets);
    const retainers = agencies.filter((a) => a.pricingModel === "retainer").length;
    const range =
      min === max
        ? `Minimum projects here start at ${formatUsd(min)}.`
        : `Minimum projects here range from ${formatUsd(min)} to ${formatUsd(max)}.`;
    const retainer =
      retainers === 0
        ? ""
        : retainers === agencies.length
          ? agencies.length === 1
            ? " It works on a monthly retainer."
            : " All of them work on a monthly retainer."
          : ` ${retainers === 1 ? "One works" : `${retainers} work`} on a monthly retainer; the others charge per video, per project or based on performance.`;
    faqs.push({ question: `How much do ${what} cost?`, answer: range + retainer });
  }

  faqs.push({
    question: "How are these agencies ranked?",
    answer: RANKING_ANSWER,
  });

  const languages = [...new Set(agencies.flatMap((a) => a.languages))].sort();
  if (languages.length > 1) {
    faqs.push({
      question: `Which languages do these agencies work in?`,
      answer: `Between them, the agencies listed here work in ${languages.join(", ")}. Use the language filter to narrow the list.`,
    });
  }

  faqs.push({
    question: `What should I ask before choosing one?`,
    answer: `Ask for case studies with real numbers, who will work on your account day to day, how they report results, and the minimum contract length. Compare at least three agencies before you decide.`,
  });

  return faqs;
}

/** First sentence of a text (up to the first ". ", "! " or "? "), for one-line summaries. */
export function firstSentence(text: string | null | undefined) {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  const m = t.match(/^.+?[.!?](?=\s|$)/);
  return m ? m[0] : t;
}

/** One line under the H1: the admin summary, else the intro's first sentence; ≤ 160 chars. */
export function oneLineSummary(
  summary: string | null | undefined,
  intro: string | null | undefined,
) {
  const line = summary?.trim() || firstSentence(intro);
  if (line.length <= 160) return line;
  return `${line.slice(0, 159).replace(/\s+\S*$/, "")}…`;
}

/** Long copy as short paragraphs (2 sentences each), keeping every word. */
export function shortParagraphs(text: string | null | undefined, perParagraph = 2) {
  return (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .flatMap((p) => {
      const sentences = p.match(/[^.!?]+[.!?]+(?:["”')\]]+)?(?:\s+|$)|[^.!?]+$/g) ?? [p];
      const out: string[] = [];
      for (let i = 0; i < sentences.length; i += perParagraph)
        out.push(
          sentences
            .slice(i, i + perParagraph)
            .join("")
            .trim(),
        );
      return out;
    });
}

/** "October 2026" from the newest of the dates; null without any. */
export function monthYear(dates: (string | null | undefined)[]) {
  const times = dates.flatMap((d) => (d ? [Date.parse(d)] : [])).filter((t) => !Number.isNaN(t));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type Sort = "recommended" | "budget";

/** Recommended keeps the ranking (lib/ranking.ts groups); budget: lowest minimum first,
 * agencies without one last. */
export function sortAgencies<T extends Pick<AgencyListItem, "minBudgetUsd">>(
  list: T[],
  sort: Sort,
) {
  if (sort !== "budget") return list;
  return [...list].sort((a, b) => (a.minBudgetUsd ?? Infinity) - (b.minBudgetUsd ?? Infinity));
}

/** Card buttons: every profile takes quote requests (lib/profile-mode.ts). */
export function cardActions(a: Pick<AgencyListItem, "slug">) {
  const profile = `/agency/${a.slug}`;
  return [
    { label: "Request a quote", href: `${profile}#contact`, primary: true },
    { label: "View profile", href: profile, primary: false },
  ];
}

const PRICING_NAME: Record<string, string> = {
  retainer: "Monthly retainer",
  per_video: "Per video",
  project: "Per project",
  performance: "Performance-based",
};

/** "At a glance" rows; rows with no data are left out. */
export function atAGlance(agencies: AgencyListItem[]) {
  const rows: { label: string; value: string }[] = [];
  if (!agencies.length) return rows;
  rows.push({ label: "Agencies listed", value: String(agencies.length) });
  const budgets = agencies.flatMap((a) => (a.minBudgetUsd === null ? [] : [a.minBudgetUsd]));
  if (budgets.length) {
    const min = Math.min(...budgets);
    const max = Math.max(...budgets);
    rows.push({
      label: "Min. project",
      value: min === max ? formatUsd(min) : `${formatUsd(min)}–${formatUsd(max)}`,
    });
  }
  const counts = new Map<string, number>();
  for (const a of agencies)
    if (a.pricingModel && PRICING_NAME[a.pricingModel])
      counts.set(a.pricingModel, (counts.get(a.pricingModel) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (top) rows.push({ label: "Most common pricing", value: PRICING_NAME[top[0]] });
  const verified = agencies.filter((a) => a.isVerified).length;
  if (verified) rows.push({ label: "Verified", value: `${verified} of ${agencies.length}` });
  return rows;
}

export const pricingName = (model: string | null) => PRICING_NAME[model ?? ""] ?? null;

/** One chip in "Explore more": a short label, the full phrase for title / aria-label. */
export type RelatedLink = { href: string; label: string; title: string; count: number };
export type RelatedGroup = {
  title: string;
  links: RelatedLink[];
  viewAll?: { href: string; label: string };
};

export const MAX_RELATED = 12;

/**
 * An "Explore more" group: live (indexable) pages only, which the caller picks from the same
 * index as the sitemap; most agencies first, then A–Z; at most 12, then "View all". Null when
 * there's nothing to link to, so the group (and an empty block) is left out.
 */
export function relatedGroup(
  title: string,
  links: RelatedLink[],
  viewAll?: { href: string; label: string },
): RelatedGroup | null {
  if (links.length === 0) return null;
  const sorted = [...links].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    title,
    links: sorted.slice(0, MAX_RELATED),
    ...(viewAll && sorted.length > MAX_RELATED ? { viewAll } : {}),
  };
}

/** "Related guides" for a directory page: 1–3 guides (already picked by guidesForPage). */
export const guideGroup = (guides: { slug: string; title: string }[]) =>
  guides.length
    ? {
        title: guides.length === 1 ? "Related guide" : "Related guides",
        links: guides.map((g, i) => ({
          href: `/guides/${g.slug}`,
          label: g.title,
          title: g.title,
          count: guides.length - i,
        })),
      }
    : null;

/** "How to choose" for pages without one service (industry and location hubs). */
export function hubHowToChoose(who: string) {
  return [
    `Start with fit. Ask each agency for case studies from ${who}, with real numbers such as cost per lead, return on ad spend or subscriber growth, and links to the channels.`,
    `Check the starting price against what you can spend each month for at least three months. Most YouTube work needs time to test and improve before results settle.`,
    `Ask how they report results and how often. Good agencies agree on one or two numbers that matter to your business before they start, and report on those rather than views alone.`,
  ];
}
