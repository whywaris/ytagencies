"use server";

import { z } from "zod";

import { emailMatchesWebsite } from "@/lib/claims";
import { alertAdmin } from "@/lib/email";
import { clientIp, underRateLimit } from "@/lib/forms/guard";
import { validRemoveLink } from "@/lib/outreach";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormResult } from "@/lib/validation/lead";

// "Remove my listing" from an outreach email (/remove-listing). The link is signed per agency; the
// sender's email must be on the agency's own domain. It lands in Admin → Inbox (topic "removal")
// with the agency attached, where an admin can archive the listing. Order (SECURITY.md):
// honeypot → Zod → rate limit → write.

const schema = z.object({
  agencyId: z.uuid(),
  token: z.string().max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Use 254 characters or fewer.")
    .pipe(z.email("Enter a valid email address.")),
  reason: z.string().trim().max(1000, "Use 1,000 characters or fewer."),
  website: z.string().max(200).optional(), // honeypot
});

export async function requestRemoval(raw: unknown): Promise<FormResult> {
  if (typeof raw === "object" && raw !== null && "website" in raw && raw.website) return { ok: true, data: undefined };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  if (!validRemoveLink(v.agencyId, v.token)) return { ok: false, error: "This link isn't valid. Reply to our email instead." };
  if (!(await underRateLimit(await clientIp(), v.email)))
    return { ok: false, error: "Too many requests. Please try again in an hour." };

  const db = createAdminClient();
  const { data: agency } = await db.from("agencies").select("id, slug, name, website, status").eq("id", v.agencyId).maybeSingle();
  if (!agency || agency.status === "archived") return { ok: true, data: undefined }; // already gone
  if (!emailMatchesWebsite(v.email, agency.website))
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { email: "Use an email address on the agency's own website domain, or reply to our email." },
    };
  const { error } = await db.from("contact_messages").insert({
    topic: "removal",
    name: agency.name.slice(0, 100),
    email: v.email,
    message: v.reason || "(No reason given.)",
    agency_url: absoluteUrl(`/agency/${agency.slug}`),
    agency_id: agency.id,
  });
  if (error) return { ok: false, error: "Something went wrong on our side. Please try again in a minute." };
  await alertAdmin(`Removal request: ${agency.name}`, [
    `${agency.name} asked to be removed. Review it in Admin → Inbox.`,
  ]);
  return { ok: true, data: undefined };
}
