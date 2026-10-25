import { z } from "zod";

import {
  adSpend,
  minContract,
  pricingUnit,
  setupFee,
  startingPrice,
} from "@/lib/validation/dashboard";
import { checkFocusTotals, profileDetailsFields } from "@/lib/validation/profile-details";

// /list-your-agency: search for an existing listing, or submit a new agency.
// Shared by the form (client) and the server action, which always re-validates.

export const agencySearchSchema = z.string().trim().min(2).max(100);

const slugs = z.array(z.string().regex(/^[a-z0-9-]{1,80}$/));

export const submitAgencySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter your agency's name.")
      .max(100, "Use 100 characters or fewer."),
    // Not called `website`: that's the honeypot field on every public form.
    siteUrl: z
      .string()
      .trim()
      .max(300, "Use 300 characters or fewer.")
      .regex(/^https?:\/\/[^\s/]+\.[^\s]+$/i, "Use a full link starting with https://"),
    services: slugs.min(1, "Choose at least one service.").max(8),
    industries: slugs
      .min(1, "Choose at least one industry.")
      .max(12, "Choose up to 12 industries."),
    // HQ: a country (required), and a city from our list or "other" with its name.
    hqCountry: z.string().regex(/^[a-z0-9-]{1,80}$/, "Choose the country you're based in."),
    hqCity: z.union([z.literal(""), z.literal("other"), z.string().regex(/^[a-z0-9-]{1,80}$/)]),
    hqCityOther: z.string().trim().max(100, "Use 100 characters or fewer."),
    /** Other countries or cities they serve. */
    locations: slugs.max(5, "Choose up to 5 other places."),
    minBudget: startingPrice,
    pricingModel: pricingUnit,
    minContract,
    adSpend,
    setupFee,
    description: z
      .string()
      .trim()
      .min(50, "Write at least 50 characters, so businesses know what you do.")
      .max(600, "Use 600 characters or fewer."),
    workEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Use 254 characters or fewer.")
      .pipe(z.email("Enter a valid email address.")),
    website: z.string().max(200).optional(), // honeypot
    ...profileDetailsFields,
  })
  .superRefine(checkFocusTotals)
  .superRefine((v, ctx) => {
    if (v.hqCity === "other" && !v.hqCityOther)
      ctx.addIssue({ code: "custom", path: ["hqCityOther"], message: "Enter your city." });
  });
export type SubmitAgencyInput = z.infer<typeof submitAgencySchema>;
