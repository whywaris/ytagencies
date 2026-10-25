import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

import { AgencyOutreachEmail } from "@/emails/agency-outreach";
import type { getMailer } from "@/lib/email";
import { absoluteUrl, BRAND_NAME } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// "You have a project request" to an unclaimed listing's address on file (Admin → Agencies),
// once per request and at most OUTREACH_PER_WEEK a week per agency, with an unsubscribe link. No
// address, or unsubscribed: nothing is sent (the 48-hour fallback still runs).

export const OUTREACH_PER_WEEK = 3;

const secret = () => {
  const s = process.env.CLAIM_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error("CLAIM_TOKEN_SECRET must be at least 32 characters");
  return s;
};
// Each link has its own label, so it never works as a claim or verification link (or as the other
// one). No expiry: an unsubscribe link should keep working.
const mac = (agencyId: string, label = "outreach-unsubscribe") =>
  createHmac("sha256", secret()).update(`${label}:${agencyId}`).digest("base64url");

function validMac(agencyId: string, token: string, label?: string) {
  if (!/^[0-9a-f-]{36}$/i.test(agencyId)) return false;
  const expected = Buffer.from(mac(agencyId, label));
  const got = Buffer.from(token);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const unsubscribeUrl = (agencyId: string) =>
  absoluteUrl(`/api/outreach/unsubscribe?a=${agencyId}&t=${mac(agencyId)}`);

export const validUnsubscribe = (agencyId: string, token: string) => validMac(agencyId, token);

/** "Remove my listing" (outreach email footer): a short form that lands in Admin → Inbox. */
export const removeListingUrl = (agencyId: string) =>
  absoluteUrl(`/remove-listing?a=${agencyId}&t=${mac(agencyId, "outreach-remove")}`);

export const validRemoveLink = (agencyId: string, token: string) =>
  validMac(agencyId, token, "outreach-remove");

/** Returns whether an email went out. */
export async function sendOutreach(
  mailer: NonNullable<ReturnType<typeof getMailer>>,
  agency: { id: string; slug: string; name: string },
  leadId: string,
) {
  const db = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: contact }, { count }] = await Promise.all([
    db
      .from("agency_outreach_contacts")
      .select("email, opted_out_at")
      .eq("agency_id", agency.id)
      .maybeSingle(),
    db
      .from("agency_outreach")
      .select("lead_id", { count: "exact", head: true })
      .eq("agency_id", agency.id)
      .gte("sent_at", weekAgo),
  ]);
  if (!contact || contact.opted_out_at || (count ?? 0) >= OUTREACH_PER_WEEK) return false;
  // Claim the (agency, lead) pair first: a retry can't send twice.
  const { error: logError } = await db
    .from("agency_outreach")
    .insert({ agency_id: agency.id, lead_id: leadId });
  if (logError) return false;
  const unsubscribe = unsubscribeUrl(agency.id);
  const { error } = await mailer.send({
    from: mailer.from,
    to: contact.email,
    subject: `You have a project request on ${BRAND_NAME}`,
    headers: {
      "List-Unsubscribe": `<${unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    react: (
      <AgencyOutreachEmail
        agencyName={agency.name}
        claimUrl={absoluteUrl(`/claim/${agency.slug}`)}
        unsubscribeUrl={unsubscribe}
      />
    ),
  });
  if (error) console.error("outreach email failed", { leadId, agencyId: agency.id });
  return !error;
}
