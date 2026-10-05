import { z } from "zod";

// Shared by the forms (client) and the server actions. The server always re-validates.

export const BUDGET_RANGES = [
  { value: "under-1k", label: "Under $1,000 a month", max: 1000 },
  { value: "1k-5k", label: "$1,000–$5,000 a month", max: 5000 },
  { value: "5k-10k", label: "$5,000–$10,000 a month", max: 10000 },
  { value: "10k-plus", label: "$10,000+ a month", max: Infinity },
  { value: "not-sure", label: "Not sure yet", max: Infinity },
] as const;

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

export const getMatchedSchema = z.object({
  service: slug("Choose a service."),
  industry: slug("Choose an industry."),
  budget,
  name,
  email,
  company,
  message: z
    .string()
    .trim()
    .max(2000, "Use 2,000 characters or fewer.")
    .optional()
    .or(z.literal("")),
  ...botFields,
});
export type GetMatchedInput = z.infer<typeof getMatchedSchema>;

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
