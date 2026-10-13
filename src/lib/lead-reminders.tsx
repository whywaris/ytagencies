import "server-only";

import { LeadReminderEmail } from "@/emails/lead-reminder";
import { getPlacement } from "@/lib/data/placement";
import { getMailer } from "@/lib/email";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

const HOUR = 60 * 60 * 1000;

/**
 * "A business is waiting for your reply": one email per routed lead that isn't marked contacted
 * 24 hours after it was sent. Runs from the daily cron; the 24–72 hour window means each lead is
 * seen by a run without old leads (from before this existed) being emailed. Claimed agencies only.
 */
export async function sendLeadReminders() {
  const mail = getMailer();
  if (!mail) return { sent: 0, skipped: "email not configured" };
  const db = createAdminClient();
  const now = Date.now();
  const { data, error } = await db
    .from("lead_routes")
    .select("lead_id, agency_id, leads(name, company), agencies(name, slug, owner_id)")
    .is("contacted_at", null)
    .is("reminded_at", null)
    .lte("sent_at", new Date(now - 24 * HOUR).toISOString())
    .gt("sent_at", new Date(now - 72 * HOUR).toISOString());
  if (error) throw error;

  const placement = await getPlacement();
  let sent = 0;
  for (const r of data) {
    const ownerId = r.agencies?.owner_id;
    // Managed agencies only: an unmanaged (lapsed) listing gets no more inquiry emails.
    if (!ownerId || !r.leads || !placement.entitlements(r.agency_id).managed) continue;
    const { data: owner } = await db.auth.admin.getUserById(ownerId);
    const to = owner.user?.email;
    if (!to) continue;
    const { error: sendError } = await mail.send({
      from: mail.from,
      to,
      subject: "A business is waiting for your reply",
      react: (
        <LeadReminderEmail
          agencyName={r.agencies!.name}
          business={r.leads.company || r.leads.name}
          url={absoluteUrl(`/dashboard/${r.agencies!.slug}/inquiries#lead-${r.lead_id}`)}
        />
      ),
    });
    if (sendError) {
      console.error("lead reminder failed", { leadId: r.lead_id, agencyId: r.agency_id });
      continue;
    }
    await db
      .from("lead_routes")
      .update({ reminded_at: new Date().toISOString() })
      .eq("lead_id", r.lead_id)
      .eq("agency_id", r.agency_id);
    sent++;
  }
  return { sent };
}
