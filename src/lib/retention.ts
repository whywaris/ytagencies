import "server-only";

import { COMPANY } from "@/lib/company";
import { monthsBefore } from "@/lib/retention-cutoff";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deletes personal data past its retention period (COMPANY.retention, shown in the privacy
 * policy). Leads older than leadsMonths go with their lead_routes and deleted_agency_routes rows
 * (both cascade). Closed contact messages go closedMessagesMonths after they were closed; open
 * ones stay.
 * Runs from the daily cron; returns counts only (nothing personal is logged).
 */
export async function purgeExpiredData(now = new Date()) {
  const db = createAdminClient();
  const leadCutoff = monthsBefore(now, COMPANY.retention.leadsMonths);
  const messageCutoff = monthsBefore(now, COMPANY.retention.closedMessagesMonths);

  const leads = await db.from("leads").delete().lt("created_at", leadCutoff).select("id");
  const messages = await db
    .from("contact_messages")
    .delete()
    .eq("status", "closed")
    // Closed messages without a closed_at (none expected) fall back to when they arrived.
    .or(`closed_at.lt.${messageCutoff},and(closed_at.is.null,created_at.lt.${messageCutoff})`)
    .select("id");
  if (leads.error || messages.error) throw new Error("Retention purge failed");
  return { leads: leads.data.length, contactMessages: messages.data.length };
}
