import { z } from "zod";

// "Request Pro" while payments are off. Shared by the form (client) and the server action.

export const proRequestSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100, "Use 100 characters or fewer."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Use 254 characters or fewer.")
    .pipe(z.email("Enter a valid email address.")),
  agency: z
    .string()
    .trim()
    .min(1, "Enter your agency's name or listing link.")
    .max(300, "Use 300 characters or fewer."),
  period: z.enum(["monthly", "yearly"], { error: "Choose monthly or yearly." }),
  website: z.string().max(200).optional(), // honeypot, checked before validation
});
export type ProRequestInput = z.infer<typeof proRequestSchema>;
