import { z } from "zod";

import { PRICING_MODELS } from "@/lib/pricing";

// The optional profile details shared by the dashboard profile form, the admin profile form and
// the agency submission form (one fragment, so the three can't drift). None of it is required.

export const REPORTING_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
export const REPORTING_LABEL: Record<(typeof REPORTING_FREQUENCIES)[number], string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  monthly: "Monthly",
};
export const MAX_PROCESS_STEPS = 5;
export const MAX_INCLUDED = 6;

const httpsUrl = z
  .string()
  .trim()
  .max(300, "Use 300 characters or fewer.")
  .refine(
    (v) => v === "" || /^https:\/\/[^\s/]+\.[^\s]+$/i.test(v),
    "Use a full link starting with https://",
  );
const percent = z
  .string()
  .trim()
  .regex(/^(\d{1,2}|100)?$/, "Enter 0 to 100, or leave it empty.");

/** "What's included": one item per line, up to 6 lines of 50 characters. */
export const includedLines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const serviceDetail = z.object({
  focus: percent,
  included: z
    .string()
    .max(400)
    .refine((v) => includedLines(v).length <= MAX_INCLUDED, `Up to ${MAX_INCLUDED} items.`)
    .refine(
      (v) => includedLines(v).every((l) => l.length <= 50),
      "Keep each item to 50 characters.",
    ),
  price: z
    .string()
    .trim()
    .regex(/^\d{0,7}$/, "Enter a whole number of US dollars, or leave it empty."),
  unit: z.enum(["", ...PRICING_MODELS]),
});
export type ServiceDetail = z.infer<typeof serviceDetail>;
export const EMPTY_SERVICE_DETAIL: ServiceDetail = { focus: "", included: "", price: "", unit: "" };

export const profileDetailsFields = {
  bestFor: z.string().trim().max(120, "Use 120 characters or fewer."),
  timezone: z.string().trim().max(60, "Use 60 characters or fewer."),
  youtubeChannelUrl: httpsUrl,
  linkedinUrl: httpsUrl,
  reportingFrequency: z.enum(["", ...REPORTING_FREQUENCIES]),
  process: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Name this step.").max(40, "Use 40 characters or fewer."),
        description: z.string().trim().max(120, "Use 120 characters or fewer."),
      }),
    )
    .max(MAX_PROCESS_STEPS, `Up to ${MAX_PROCESS_STEPS} steps.`),
  /** Keyed by service slug; only the services chosen in the form are saved. */
  serviceDetails: z.record(z.string(), serviceDetail),
  /** Keyed by industry slug. */
  industryFocus: z.record(z.string(), percent),
};

/** Sum of the focus percentages filled in for the chosen items; null when none are filled in. */
export function focusTotal(chosen: string[], focus: (slug: string) => string | undefined) {
  const filled = chosen.map(focus).filter((v): v is string => !!v && v.trim() !== "");
  return filled.length === 0 ? null : filled.reduce((n, v) => n + Number(v), 0);
}

type WithDetails = {
  services: string[];
  industries: string[];
  serviceDetails: Record<string, ServiceDetail>;
  industryFocus: Record<string, string>;
};

/**
 * Focus percentages are optional, but once any are filled in they must add up to 100 (services
 * and industries separately). Checked in the forms only, not as a database constraint.
 */
export function checkFocusTotals(v: WithDetails, ctx: z.RefinementCtx) {
  const services = focusTotal(v.services, (s) => v.serviceDetails[s]?.focus);
  if (services !== null && services !== 100)
    ctx.addIssue({
      code: "custom",
      path: ["serviceDetails"],
      message: `Service focus should add up to 100% (now ${services}%).`,
    });
  const industries = focusTotal(v.industries, (i) => v.industryFocus[i]);
  if (industries !== null && industries !== 100)
    ctx.addIssue({
      code: "custom",
      path: ["industryFocus"],
      message: `Industry focus should add up to 100% (now ${industries}%).`,
    });
}

export const EMPTY_DETAILS = {
  bestFor: "",
  timezone: "",
  youtubeChannelUrl: "",
  linkedinUrl: "",
  reportingFrequency: "" as const,
  process: [] as { title: string; description: string }[],
  serviceDetails: {} as Record<string, ServiceDetail>,
  industryFocus: {} as Record<string, string>,
};
