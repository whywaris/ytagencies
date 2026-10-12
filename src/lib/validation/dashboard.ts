import { z } from "zod";

import { AD_SPENDS, MIN_CONTRACTS } from "@/lib/pricing";

// Dashboard forms. Shared by client and server; the server always re-validates.

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

export const PRICING_MODELS = ["retainer", "per_video", "project", "performance"] as const;
export const METRIC_UNITS = [
  { value: "", label: "Number" },
  { value: "usd", label: "US$" },
  { value: "gbp", label: "£" },
  { value: "pct", label: "%" },
] as const;

/** Starting price and its unit: required on every agency form. "" is the unfilled form value. */
export const startingPrice = z
  .string()
  .trim()
  .regex(/^[1-9]\d{0,6}$/, "Enter your starting price in whole US dollars.");
export const pricingUnit = z
  .enum(["", ...PRICING_MODELS])
  // ": boolean" keeps "" in the form type (an inferred type guard would narrow it out).
  .refine((v): boolean => v !== "", "Choose how you charge.");

/** Minimum contract and ad spend: required; setup fee optional. "" is the unfilled form value. */
export const minContract = z
  .enum(["", ...MIN_CONTRACTS])
  .refine((v): boolean => v !== "", "Choose your minimum contract.");
export const adSpend = z
  .enum(["", ...AD_SPENDS])
  .refine((v): boolean => v !== "", "Choose how ad spend is paid.");
export const setupFee = z
  .string()
  .trim()
  .regex(/^\d{0,7}$/, "Enter a whole number of US dollars, or leave it empty.");

export const profileSchema = z
  .object({
    description: z.string().trim().max(5000, "Use 5,000 characters or fewer."),
    minBudget: startingPrice,
    pricingModel: pricingUnit,
    minContract,
    adSpend,
    setupFee,
    services: z.array(slug).min(1, "Choose at least one service.").max(8),
    primaryService: slug.or(z.literal("")),
    industries: z.array(slug).max(12, "Choose up to 12 industries."),
    primaryIndustry: slug.or(z.literal("")),
    locations: z.array(slug).max(40, "Choose up to 40 locations."),
  })
  .refine((v) => v.primaryService === "" || v.services.includes(v.primaryService), {
    path: ["primaryService"],
    message: "Your main service must be one of the services you offer.",
  })
  .refine((v) => v.primaryIndustry === "" || v.industries.includes(v.primaryIndustry), {
    path: ["primaryIndustry"],
    message: "Your main industry must be one of the industries you work with.",
  });
export type ProfileInput = z.infer<typeof profileSchema>;

export const caseStudySchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3, "Add a title.").max(120, "Use 120 characters or fewer."),
  industry: slug.or(z.literal("")),
  channelUrl: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v),
      "Use a full link starting with https://",
    ),
  summary: z.string().trim().max(600, "Use 600 characters or fewer."),
  metrics: z
    .array(
      z.object({
        label: z.string().trim().min(1, "Name this result.").max(40),
        value: z
          .string()
          .trim()
          .regex(/^-?\d{1,9}(\.\d{1,2})?$/, "Enter a number, like 48 or 3.2."),
        unit: z.enum(["", "usd", "gbp", "pct"]),
      }),
    )
    .max(6, "Add up to 6 results."),
});
export type CaseStudyInput = z.infer<typeof caseStudySchema>;

/** Form rows → metrics JSON, using the key convention formatMetrics() reads: name + unit suffix. */
export function metricsToJson(rows: CaseStudyInput["metrics"]) {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const base = r.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    if (!base) continue;
    out[r.unit ? `${base}_${r.unit}` : base] = Number(r.value);
  }
  return out;
}

const ACRONYMS = new Set(["roas", "ctr", "cpa", "cpm", "cpv", "roi"]);

/** Metrics JSON → form rows, for editing. */
export function jsonToMetrics(json: unknown): CaseStudyInput["metrics"] {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  return Object.entries(json as Record<string, unknown>).flatMap(([key, value]) => {
    if (typeof value !== "number") return [];
    const parts = key.split("_");
    const last = parts[parts.length - 1];
    const unit =
      last === "usd" || last === "gbp" || last === "pct"
        ? (parts.pop() as "usd" | "gbp" | "pct")
        : "";
    const words = parts.map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w));
    const label = words.join(" ");
    return [{ label: label.charAt(0).toUpperCase() + label.slice(1), value: String(value), unit }];
  });
}
