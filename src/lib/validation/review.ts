import { z } from "zod";

import { TEAM_SIZES } from "@/lib/validation/admin";

// Admin → Reviews create/edit (Clutch-style fields). No public review form yet.

export const REVIEW_BUDGETS = [
  { value: "under_10k", label: "Under $10,000" },
  { value: "10k_50k", label: "$10,000–$50,000" },
  { value: "50k_200k", label: "$50,000–$200,000" },
  { value: "200k_plus", label: "$200,000+" },
] as const;
export const REVIEW_STATUSES = ["pending", "published", "rejected"] as const;
export const SCORE_KEYS = ["scoreQuality", "scoreSchedule", "scoreCost", "scoreRefer"] as const;
export const SCORE_LABEL: Record<(typeof SCORE_KEYS)[number], string> = {
  scoreQuality: "Quality",
  scoreSchedule: "Schedule",
  scoreCost: "Cost",
  scoreRefer: "Would refer",
};
/** 1, 1.5, … 5 */
export const SCORE_STEPS = Array.from({ length: 9 }, (_, i) => String(1 + i / 2));

const slugOrEmpty = z.string().regex(/^[a-z0-9-]{0,80}$/);
const date = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use a date.");
const score = z.enum(["", ...SCORE_STEPS]);

export const reviewSchema = z
  .object({
    agencyId: z.uuid("Choose an agency."),
    status: z.enum(REVIEW_STATUSES),
    authorName: z.string().trim().min(1, "Add the reviewer's name.").max(100),
    authorCompany: z.string().trim().max(120),
    reviewerTitle: z.string().trim().max(100),
    reviewerIndustry: slugOrEmpty,
    reviewerCompanySize: z.enum(["", ...TEAM_SIZES]),
    reviewerCountry: z.string().trim().max(60),
    service: slugOrEmpty,
    budgetRange: z.enum(["", ...REVIEW_BUDGETS.map((b) => b.value)]),
    projectStart: date,
    projectEnd: date,
    scoreQuality: score,
    scoreSchedule: score,
    scoreCost: score,
    scoreRefer: score,
    /** Used only when there are no scores; otherwise the rating is the rounded overall. */
    rating: z.enum(["", "1", "2", "3", "4", "5"]),
    body: z.string().trim().min(30, "Write at least 30 characters.").max(2000),
    /** Links the review to a lead, which marks it "Verified client". */
    leadId: z.union([z.literal(""), z.uuid("Paste a lead ID, or leave it empty.")]),
  })
  .superRefine((v, ctx) => {
    const filled = SCORE_KEYS.filter((k) => v[k] !== "").length;
    if (filled !== 0 && filled !== 4)
      ctx.addIssue({
        code: "custom",
        path: ["scoreQuality"],
        message: "Give all four scores, or none.",
      });
    if (filled === 0 && v.rating === "")
      ctx.addIssue({
        code: "custom",
        path: ["rating"],
        message: "Give a rating, or the four scores.",
      });
    if (v.projectEnd && !v.projectStart)
      ctx.addIssue({
        code: "custom",
        path: ["projectStart"],
        message: "Add when the project started.",
      });
    if (v.projectStart && v.projectEnd && v.projectEnd < v.projectStart)
      ctx.addIssue({
        code: "custom",
        path: ["projectEnd"],
        message: "The end is before the start.",
      });
  });
export type ReviewInput = z.infer<typeof reviewSchema>;

/** Average of the four scores (what the database stores as `overall`), or null. */
export function overallOf(v: Pick<ReviewInput, (typeof SCORE_KEYS)[number]>) {
  if (SCORE_KEYS.some((k) => v[k] === "")) return null;
  return Math.round((SCORE_KEYS.reduce((n, k) => n + Number(v[k]), 0) / 4) * 100) / 100;
}
