import type { AgencyListItem } from "@/lib/data/agencies";
import type { Faq, Segment, Service } from "@/lib/data/taxonomy";
import { BRAND_NAME } from "@/lib/site";

// Copy and SEO text for directory pages (docs/SEO.md patterns). Pure functions, no data access.

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
export function directoryTitle(service: Service, segment?: Segment) {
  const h1 = directoryHeading(service, segment);
  const year = new Date().getFullYear();
  const bare = segment
    ? `${service.name} Agencies ${segmentPhrase(segment)}`
    : `${service.name} Agencies`;
  return firstThatFits([`${h1} (${year}) | ${BRAND_NAME}`, `${h1} (${year})`, h1, bare], 60);
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

/** FAQs built from the agencies on the page, used when no hand-written FAQs exist. */
export function defaultFaqs(
  service: Service,
  agencies: AgencyListItem[],
  segment?: Segment,
): Faq[] {
  const what = `${service.name} agencies${segment ? ` ${segmentPhrase(segment)}` : ""}`;
  const faqs: Faq[] = [];

  const budgets = agencies.flatMap((a) => (a.minBudgetUsd === null ? [] : [a.minBudgetUsd]));
  if (budgets.length > 0) {
    const min = Math.min(...budgets);
    const max = Math.max(...budgets);
    const retainers = agencies.filter((a) => a.pricingModel === "retainer").length;
    faqs.push({
      question: `How much do ${what} cost?`,
      answer:
        `Minimum budgets for the ${agencies.length} agencies listed here range from ${formatUsd(min)} to ${formatUsd(max)}. ` +
        `${retainers} of them work on a monthly retainer; the rest charge per video, per project or based on performance.`,
    });
  }

  const verified = agencies.filter((a) => a.isVerified).length;
  faqs.push({
    question: `How many ${what} are listed?`,
    answer:
      agencies.length === 0
        ? `None yet. We're adding agencies to this list now. You can tell us what you need and we'll match you with agencies that fit.`
        : `${agencies.length} ${agencies.length === 1 ? "agency is" : "agencies are"} listed, and ${verified} ${verified === 1 ? "has" : "have"} a Verified badge. Featured agencies pay for placement and are labeled.`,
  });

  const languages = [...new Set(agencies.flatMap((a) => a.languages))].sort();
  if (languages.length > 1) {
    faqs.push({
      question: `Which languages do these agencies work in?`,
      answer: `Between them, the agencies listed here work in ${languages.join(", ")}. Use the language filter to narrow the list.`,
    });
  }

  faqs.push({
    question: `What should I ask before hiring one?`,
    answer: `Ask for case studies with real numbers, who will work on your account day to day, how they report results, and the minimum contract length. Compare at least three agencies before you decide.`,
  });

  return faqs;
}
