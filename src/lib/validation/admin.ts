import { z } from "zod";

// Admin forms. Shared by client and server; the server always re-validates.

export const TEAM_SIZES = ["1-10", "11-50", "51-200", "200+"] as const;

export const agencySchema = z.object({
  name: z.string().trim().min(2, "Add a name.").max(120),
  // Lowercase kebab-case; never changes after publish (CLAUDE.md routing rules).
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens."),
  tagline: z.string().trim().max(160, "Use 160 characters or fewer."),
  website: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => v === "" || /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v),
      "Use a full link starting with https://",
    ),
  foundedYear: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (/^\d{4}$/.test(v) && +v >= 1900 && +v <= new Date().getFullYear()),
      "Enter a year, or leave it empty.",
    ),
  teamSize: z.enum(["", ...TEAM_SIZES]),
  languages: z.string().trim().max(200),
  // Admin only (owners have no write grant): override the profile's search title / description.
  seoTitle: z.string().trim().max(70, "Use 70 characters or fewer."),
  seoDescription: z.string().trim().max(200, "Use 200 characters or fewer."),
  hqLocation: z.string().regex(/^[a-z0-9-]{0,80}$/),
});
export type AgencyInput = z.infer<typeof agencySchema>;

export const introSchema = z.object({
  intro: z.string().trim().max(3000, "Use 3,000 characters or fewer."),
});
export type IntroInput = z.infer<typeof introSchema>;

export const comboContentSchema = z.object({
  intro: z.string().trim().max(3000, "Use 3,000 characters or fewer."),
  howToChoose: z.string().trim().max(5000, "Use 5,000 characters or fewer."),
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(5, "Write the question.").max(200),
        answer: z.string().trim().min(10, "Write the answer.").max(1500),
      }),
    )
    .max(8, "Use up to 8 FAQs."),
});
export type ComboContentInput = z.infer<typeof comboContentSchema>;
