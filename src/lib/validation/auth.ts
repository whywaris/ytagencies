import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Use 254 characters or fewer.")
  .pipe(z.email("Enter a valid email address."));
const botFields = {
  turnstileToken: z.string().min(1, "Complete the security check.").max(2048),
  website: z.string().max(200).optional(), // honeypot
};

// Sign-in uses Turnstile in invisible mode (a box only appears when Cloudflare wants a challenge).
export const loginSchema = z.object({
  email,
  next: z.string().max(500).optional(),
  turnstileToken: z
    .string()
    .min(1, "Verification failed. Refresh the page and try again.")
    .max(2048),
  website: botFields.website,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const claimSchema = z.object({
  agencySlug: z.string().regex(/^[a-z0-9-]{1,80}$/, "This agency is no longer listed."),
  workEmail: email,
  ...botFields,
});
export type ClaimInput = z.infer<typeof claimSchema>;

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/, "This agency is no longer listed.");
const role = z
  .string()
  .trim()
  .min(2, "Enter your role at the agency.")
  .max(100, "Use 100 characters or fewer.");

/** No email on the agency's domain: proof an admin checks by hand. */
export const claimProofSchema = z.object({
  agencySlug: slug,
  role,
  linkedinUrl: z
    .string()
    .trim()
    .max(300, "Use 300 characters or fewer.")
    .regex(/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/\S+$/i, "Paste your LinkedIn profile link."),
  note: z.string().trim().max(1000, "Use 1,000 characters or fewer."),
  ...botFields,
});
export type ClaimProofInput = z.infer<typeof claimProofSchema>;
