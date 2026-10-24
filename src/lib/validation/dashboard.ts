import { z } from "zod";

import { AD_SPENDS, MIN_CONTRACTS, PRICING_MODELS } from "@/lib/pricing";
import { checkFocusTotals, profileDetailsFields } from "@/lib/validation/profile-details";

// Dashboard forms. Shared by client and server; the server always re-validates.

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

export { PRICING_MODELS };

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
    // Where they're based (a country, optionally a city typed by name: created on save if new)
    // and the countries they serve remotely (lib/data/cities.ts).
    hqCountry: slug.or(z.literal("")),
    hqCity: z.string().trim().max(80, "Use 80 characters or fewer."),
    serves: z.array(slug).max(60, "Choose up to 60 countries."),
    servesWorldwide: z.boolean(),
    ...profileDetailsFields,
  })
  .superRefine(checkFocusTotals)
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
  service: slug.or(z.literal("")),
  // Shown as big figures on the profile: "+340%" / "Organic views". Up to 3 (DB check too).
  metrics: z
    .array(
      z.object({
        value: z.string().trim().min(1, "Add the figure.").max(12, "Use 12 characters or fewer."),
        label: z.string().trim().min(1, "Name this result.").max(40, "Use 40 characters or fewer."),
      }),
    )
    .max(3, "Add up to 3 results."),
});
export type CaseStudyInput = z.infer<typeof caseStudySchema>;

/** Stored metrics (jsonb array of {value, label}) → form rows. */
export function jsonToMetrics(json: unknown): CaseStudyInput["metrics"] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((m) =>
    m && typeof m.value === "string" && typeof m.label === "string"
      ? [{ value: m.value, label: m.label }]
      : [],
  );
}
