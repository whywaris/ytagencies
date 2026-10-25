// Industry matching for the enrichment script (scripts/enrich-industries.mjs): page text →
// suggestions with the exact sentence as evidence. Pure, no network. Tested (tests/enrich.test.mjs).

export type Page = { url: string; text: string };
export type Suggestion = {
  industry: string;
  evidence: string;
  sourceUrl: string;
  method: "keywords" | "llm";
  confidence: number;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One regex per industry: whole words, optional plural, "*" = any ending. Case-insensitive. */
export function compileSynonyms(synonyms: Record<string, string[]>) {
  const out = new Map<string, RegExp>();
  for (const [slug, terms] of Object.entries(synonyms)) {
    const alts = terms.map((t) =>
      t.endsWith("*") ? `${escape(t.slice(0, -1))}[\\p{L}\\p{N}-]*` : `${escape(t)}(?:e?s)?`,
    );
    out.set(slug, new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join("|")})(?![\\p{L}\\p{N}])`, "giu"));
  }
  return out;
}

/** Sentences of a page's text: split at . ! ? and line breaks, whitespace collapsed. */
export function sentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 12);
}

/** A sentence, cut to ≤ max characters around its first match (still a literal piece of the page). */
export function clip(sentence: string, index: number, max = 300) {
  if (sentence.length <= max) return sentence;
  const start = Math.max(0, Math.min(index - Math.floor(max / 3), sentence.length - max));
  return sentence.slice(start, start + max).trim();
}

// Pages whose URL says they list clients or industries count a little more.
const STRONG_PAGE = /industr|clients|case-stud|work|portfolio/i;

/**
 * Keyword suggestions from an agency's pages. Confidence: 0.5 for one phrase, +0.15 per further
 * distinct phrase (up to two), +0.1 for three or more mentions, +0.1 when found on a
 * clients/industries page; a single weak phrase ("app") stays at 0.35. Capped at 0.95.
 */
export function matchIndustries(
  pages: Page[],
  synonyms: Record<string, string[]>,
  weak: Set<string> = new Set(),
): Suggestion[] {
  const out: Suggestion[] = [];
  for (const [industry, re] of compileSynonyms(synonyms)) {
    const terms = new Set<string>();
    let mentions = 0;
    let strongPage = false;
    let best: { evidence: string; url: string; score: number } | null = null;
    for (const page of pages) {
      for (const s of sentences(page.text)) {
        const hits = [...s.matchAll(re)];
        if (!hits.length) continue;
        const distinct = new Set(hits.map((h) => h[0].toLowerCase()));
        distinct.forEach((t) => terms.add(t));
        mentions += hits.length;
        if (STRONG_PAGE.test(new URL(page.url).pathname)) strongPage = true;
        const score = [...distinct].filter((t) => !weak.has(t)).length * 2 + distinct.size;
        if (!best || score > best.score)
          best = { evidence: clip(s, hits[0].index ?? 0), url: page.url, score };
      }
    }
    if (!best) continue;
    const strong = [...terms].filter((t) => !weak.has(t));
    let confidence = strong.length
      ? 0.5 + 0.15 * Math.min(strong.length - 1, 2) + (mentions >= 3 ? 0.1 : 0) + (strongPage ? 0.1 : 0)
      : 0.35;
    confidence = Math.min(0.95, Math.round(confidence * 100) / 100);
    out.push({ industry, evidence: best.evidence, sourceUrl: best.url, method: "keywords", confidence });
  }
  return out;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** The LLM rule: a quote counts only if it's a literal piece of a fetched page (spaces aside). */
export function quoteIsLiteral(quote: string, text: string) {
  const q = squash(quote);
  return q.length >= 12 && q.length <= 300 && squash(text).includes(q);
}

/** Which page a literal quote came from (the first that has it). */
export function pageWithQuote(quote: string, pages: Page[]) {
  return pages.find((p) => quoteIsLiteral(quote, p.text)) ?? null;
}

export type Candidate = {
  id: string;
  slug: string;
  website: string | null;
  is_claimed: boolean;
  status: string;
};

/**
 * Agencies to look at: published, unclaimed (an owner's own choices win), with a website, and
 * not checked in the last 30 days (unless asked for by slug).
 */
export function selectCandidates(
  agencies: Candidate[],
  checkedAt: Map<string, string>,
  now: Date,
  opts: { slug?: string; limit?: number } = {},
) {
  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  return agencies
    .filter((a) => a.status === "published" && !a.is_claimed && !!a.website)
    .filter((a) => (opts.slug ? a.slug === opts.slug : true))
    .filter((a) => opts.slug || !(checkedAt.has(a.id) && Date.parse(checkedAt.get(a.id)!) > cutoff))
    .slice(0, opts.limit ?? Infinity);
}

/** Drops industries the agency already has, or was already suggested (any status). */
export function newSuggestions(found: Suggestion[], taken: Set<string>) {
  const best = new Map<string, Suggestion>();
  for (const s of found) {
    if (taken.has(s.industry)) continue;
    const prev = best.get(s.industry);
    if (!prev || s.confidence > prev.confidence) best.set(s.industry, s);
  }
  return [...best.values()];
}

/** Evidence split into plain and matched pieces, for highlighting the words that matched. */
export function highlightParts(text: string, re: RegExp | undefined) {
  if (!re) return [{ text, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
    const i = m.index ?? 0;
    if (i > at) parts.push({ text: text.slice(at, i), hit: false });
    parts.push({ text: m[0], hit: true });
    at = i + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts;
}

/**
 * Service × industry combos that reached `min` agencies thanks to tags approved recently: the
 * count today is ≥ min, and without those approvals it would be below. `counts` is keyed
 * "service|industry"; each recent approval adds one to every service its agency offers.
 */
export function crossedThreshold(
  counts: Map<string, number>,
  recent: { agencyId: string; industry: string }[],
  servicesOf: Map<string, string[]>,
  min: number,
) {
  const gained = new Map<string, number>();
  for (const r of recent)
    for (const s of servicesOf.get(r.agencyId) ?? []) {
      const k = `${s}|${r.industry}`;
      gained.set(k, (gained.get(k) ?? 0) + 1);
    }
  return [...gained]
    .filter(([k, g]) => (counts.get(k) ?? 0) >= min && (counts.get(k) ?? 0) - g < min)
    .map(([k]) => {
      const [service, industry] = k.split("|");
      return { service, industry, count: counts.get(k)! };
    })
    .sort((a, b) => b.count - a.count || a.service.localeCompare(b.service));
}
