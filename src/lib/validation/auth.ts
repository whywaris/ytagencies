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

// Sign-in has no Turnstile: rate limits (ours and Supabase's) and the honeypot guard it.
export const loginSchema = z.object({
  email,
  next: z.string().max(500).optional(),
  website: botFields.website,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const claimSchema = z.object({
  agencySlug: z.string().regex(/^[a-z0-9-]{1,80}$/, "This agency is no longer listed."),
  workEmail: email,
  ...botFields,
});
export type ClaimInput = z.infer<typeof claimSchema>;
