// What an agency not on Pro sees of a request, and when a profile request falls back to similar
// agencies. Pure, no imports: tested (tests/lead-preview.test.mjs).
//
// A preview never contains the visitor's name, email, phone, company, website, channel link or
// anything else that identifies them: service, niche, budget, timeline, goal, country and a short
// summary with contact details removed.

export const SUMMARY_MAX = 160;
export const FALLBACK_HOURS = 48;

const PATTERNS: RegExp[] = [
  /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/g, // emails
  /\b(?:https?:\/\/|www\.)\S+/gi, // links
  /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|ai|app|dev|me|tv|uk|us|ca|au|in|pk|de|fr|es|it|nl|xyz|info|biz)(?:\/\S*)?/gi, // bare domains
  /(?:^|\s)@[a-z0-9_.-]{2,}/gi, // @handles
  /\+?\d[\d\s().-]{6,}\d/g, // phone numbers and long digit runs
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The message as a short preview: contact details and the visitor's own name and company taken
 * out, whitespace collapsed, cut at a word boundary under SUMMARY_MAX characters.
 */
export function redactSummary(
  message: string | null | undefined,
  known: { name?: string | null; company?: string | null } = {},
) {
  let text = (message ?? "").replace(/\s+/g, " ");
  for (const p of PATTERNS) text = text.replace(p, " [removed] ");
  // Every word of the name and company (3+ letters), wherever it appears.
  const words = [known.name, known.company]
    .flatMap((v) => (v ?? "").split(/[^A-Za-zÀ-ɏ0-9']+/))
    .filter((w) => w.length >= 3);
  for (const w of words) text = text.replace(new RegExp(`\\b${escape(w)}\\b`, "gi"), "[removed]");
  text = text
    .replace(/(\s*\[removed\]\s*)+/g, " [removed] ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= SUMMARY_MAX) return text;
  const cut = text.slice(0, SUMMARY_MAX - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), SUMMARY_MAX / 2)).trim()}…`;
}

/** Country as typed, cut short and run through the same redaction (it's free text). */
export const previewCountry = (raw: string | null | undefined) =>
  redactSummary((raw ?? "").slice(0, 60)) || null;

export type LeadPreview = {
  service: string | null;
  industry: string | null;
  budget: string | null;
  timeline: string | null;
  goal: string | null;
  country: string | null;
  summary: string | null;
};

/** Only these keys ever reach a free owner (dashboard and emails). */
export const PREVIEW_KEYS: (keyof LeadPreview)[] = [
  "service",
  "industry",
  "budget",
  "timeline",
  "goal",
  "country",
  "summary",
];

/** Copies only the preview fields, whatever else the object holds. */
export function toPreview(row: Partial<Record<string, unknown>>): LeadPreview {
  const pick = (k: string) => (typeof row[k] === "string" && row[k] ? (row[k] as string) : null);
  return {
    service: pick("service"),
    industry: pick("industry"),
    budget: pick("budget"),
    timeline: pick("timeline"),
    goal: pick("goal"),
    country: previewCountry(pick("country")),
    summary: pick("summary"),
  };
}

/**
 * A profile request goes to similar Pro agencies once 48 hours have passed, unless the agency
 * opened or answered it while on Pro. Only with the visitor's consent, and only once.
 */
export function fallbackDue(
  r: {
    sentAt: string;
    consent: boolean;
    fallbackAt: string | null;
    /** The agency is on Pro now. */
    managed: boolean;
    openedAt: string | null;
    contactedAt: string | null;
  },
  now = new Date(),
) {
  if (!r.consent || r.fallbackAt) return false;
  if (now.getTime() - new Date(r.sentAt).getTime() < FALLBACK_HOURS * 3_600_000) return false;
  return !(r.managed && (r.openedAt || r.contactedAt));
}
