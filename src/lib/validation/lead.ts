import { z } from "zod";

// Shared by the forms (client) and the server actions. The server always re-validates.

/** Monthly budget. `label` for emails and lists, `short` for the form's chips. */
export const BUDGET_RANGES = [
  { value: "under-1k", short: "Under $1k", label: "Under $1,000 a month", max: 1000 },
  { value: "1k-3k", short: "$1k–3k", label: "$1,000–$3,000 a month", max: 3000 },
  { value: "3k-5k", short: "$3k–5k", label: "$3,000–$5,000 a month", max: 5000 },
  { value: "5k-10k", short: "$5k–10k", label: "$5,000–$10,000 a month", max: 10000 },
  { value: "10k-plus", short: "$10k+", label: "$10,000+ a month", max: Infinity },
  { value: "not-sure", short: "Not sure yet", label: "Not sure yet", max: Infinity },
] as const;

/** A stored budget's label, including the range used before the $1k–3k / $3k–5k split. */
export const budgetLabel = (value: string | null | undefined) =>
  value === "1k-5k"
    ? "$1,000–$5,000 a month"
    : (BUDGET_RANGES.find((b) => b.value === value)?.label ?? null);

export const GOALS = [
  { value: "leads-sales", label: "More leads or sales" },
  { value: "views-subs", label: "More views and subscribers" },
  { value: "brand", label: "Brand awareness" },
  { value: "not-sure", label: "Not sure yet" },
] as const;

export const START_TIMELINES = [
  { value: "asap", label: "As soon as possible" },
  { value: "this-month", label: "This month" },
  { value: "exploring", label: "Just exploring" },
] as const;

export const PRIOR_AGENCY = [
  { value: "first", label: "No, this is our first time" },
  { value: "went-well", label: "Yes, and it went well" },
  { value: "didnt-work", label: "Yes, but it didn't work out" },
] as const;

/** Label for a stored choice, or null. */
export const choiceLabel = (
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
) => list.find((o) => o.value === value)?.label ?? null;

const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

/**
 * "ytagencies.com" → "https://ytagencies.com/". Adds https:// when there's no scheme; only http(s)
 * and a host with a dot. Null when it isn't a usable link.
 */
export function normalizeUrl(raw: string) {
  const v = raw.trim();
  if (!v) return "";
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    if (!/^https?:$/.test(url.protocol) || !/\.[a-z]{2,}$/i.test(url.hostname)) return null;
    if (url.username || url.password) return null;
    return url.href.slice(0, 300);
  } catch {
    return null;
  }
}

const optionalUrl = (message: string, host?: RegExp) =>
  z
    .string()
    .max(300, "Use 300 characters or fewer.")
    .transform((v, ctx) => {
      const url = normalizeUrl(v);
      if (url === null || (url && host && !host.test(new URL(url).hostname))) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return url;
    });

const budget = z.enum(BUDGET_RANGES.map((b) => b.value) as [string, ...string[]], {
  error: "Choose a budget range.",
});
const slug = (message: string) => z.string().regex(/^[a-z0-9-]{1,80}$/, message);
const name = z.string().trim().min(1, "Enter your name.").max(100, "Use 100 characters or fewer.");
// Trim and lowercase before the format check, so " Ana@X.com " passes and is stored normalized.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Use 254 characters or fewer.")
  .pipe(z.email("Enter a valid email address."));
const company = z
  .string()
  .trim()
  .max(120, "Use 120 characters or fewer.")
  .optional()
  .or(z.literal(""));

// Bot checks travel with the payload: Turnstile token and an always-empty honeypot.
const botFields = {
  turnstileToken: z.string().min(1, "Complete the security check.").max(2048),
  website: z.string().max(200).optional(), // honeypot, checked before validation
};

/** Get matched, step 1: the project. */
export const getMatchedStep1 = z.object({
  service: slug("Choose a service."),
  industry: slug("Choose an industry."),
  goal: z.enum(values(GOALS), { error: "Choose your main goal." }),
  budget: z.enum(values(BUDGET_RANGES), { error: "Choose a budget range." }),
  start: z.enum(values(START_TIMELINES), { error: "Choose when you want to start." }),
});

/** Get matched, step 2: the business's details. */
export const getMatchedStep2 = z.object({
  name,
  email,
  businessUrl: optionalUrl("Enter a website, like ytagencies.com."),
  channelUrl: optionalUrl(
    "Enter a YouTube link, like youtube.com/@yourchannel.",
    /(^|\.)(youtube\.com|youtu\.be)$/i,
  ),
  customerLocation: z.string().trim().max(120, "Use 120 characters or fewer."),
  priorAgency: z.enum(["", ...values(PRIOR_AGENCY)]),
  message: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
  /** Where the request started, e.g. "profile:<slug>" from an unmanaged profile. */
  ref: z
    .string()
    .regex(/^[a-z]+(:[a-z0-9-]{1,80})?$/)
    .optional()
    .or(z.literal("")),
  ...botFields,
});

export const getMatchedSchema = getMatchedStep1.extend(getMatchedStep2.shape);
export type GetMatchedInput = z.input<typeof getMatchedSchema>;
export type GetMatchedData = z.output<typeof getMatchedSchema>;

export const contactAgencySchema = z.object({
  agencySlug: slug("This agency is no longer listed."),
  name,
  email,
  company,
  budget: budget.optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(20, "Tell the agency a bit more (at least 20 characters).")
    .max(2000, "Use 2,000 characters or fewer."),
  ...botFields,
});
export type ContactAgencyInput = z.infer<typeof contactAgencySchema>;

export type FormResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };
