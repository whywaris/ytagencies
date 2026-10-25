import { z } from "zod";

import { TOPIC_IDS } from "@/lib/contact-topics";

// /contact form. Shared by the form (client) and the server action, which always re-validates.

export const contactSchema = z
  .object({
    topic: z.enum(TOPIC_IDS, { error: "Choose a topic." }),
    name: z.string().trim().min(1, "Enter your name.").max(100, "Use 100 characters or fewer."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Use 254 characters or fewer.")
      .pipe(z.email("Enter a valid email address.")),
    message: z
      .string()
      .trim()
      .min(10, "Tell us a little more (at least 10 characters).")
      .max(5000, "Use 5,000 characters or fewer."),
    // "Report a listing": the profile or website link.
    agencyUrl: z
      .string()
      .trim()
      .max(300, "Use 300 characters or fewer.")
      .refine(
        (v) => v === "" || /^https?:\/\/\S+\.\S+$/i.test(v),
        "Paste the full link, starting with https://.",
      )
      .optional()
      .or(z.literal("")),
    website: z.string().max(200).optional(), // honeypot, checked before validation
  })
  .refine((v) => v.topic !== "report" || !!v.agencyUrl, {
    path: ["agencyUrl"],
    message: "Add the link to the listing you're reporting.",
  });
export type ContactInput = z.infer<typeof contactSchema>;
