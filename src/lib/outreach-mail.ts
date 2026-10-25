import "server-only";
import { randomBytes } from "node:crypto";

import { getMailer } from "@/lib/email";
import { removeListingUrl, unsubscribeUrl } from "@/lib/outreach";
import {
  blockedReason,
  reminderDue,
  renderTemplate,
  runQuota,
  sendingProblems,
  textToHtml,
  type Template,
} from "@/lib/outreach-rules";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// Outreach emails to unclaimed agencies (Admin → Growth → Outreach). The cron
// (/api/cron/outreach, hourly on weekdays 09:00–17:00 UTC) queues reminders and sends what's
// queued, within the daily cap. Every send re-checks the agency: still published and unclaimed,
// address not unsubscribed, bounced or complained, no request email this week. Plain text plus
// simple HTML, no images, no open tracking; only clicks on our own claim link are counted.

type Db = ReturnType<typeof createAdminClient>;

export const newToken = () => randomBytes(24).toString("base64url"); // 32 characters

export async function getOutreachSettings(db: Db = createAdminClient()) {
  const { data, error } = await db
    .from("app_settings")
    .select(
      "outreach_sender_name, outreach_from, outreach_reply_to, outreach_business_address, outreach_daily_cap, outreach_reminder_days, outreach_paused, outreach_invite_subject, outreach_invite_body, outreach_reminder_subject, outreach_reminder_body",
    )
    .single();
  if (error) throw error;
  return {
    senderName: data.outreach_sender_name,
    from: data.outreach_from,
    replyTo: data.outreach_reply_to,
    businessAddress: data.outreach_business_address,
    dailyCap: data.outreach_daily_cap,
    reminderDays: data.outreach_reminder_days,
    paused: data.outreach_paused,
    templates: {
      invite: { subject: data.outreach_invite_subject, body: data.outreach_invite_body },
      reminder: { subject: data.outreach_reminder_subject, body: data.outreach_reminder_body },
    },
  };
}
export type Settings = Awaited<ReturnType<typeof getOutreachSettings>>;

export const claimLink = (slug: string, token: string) =>
  absoluteUrl(`/claim/${slug}?t=${encodeURIComponent(token)}`);

/** Subject, text and HTML for one agency. The "Remove my listing" line is always added. */
export function composeEmail(
  settings: Settings,
  template: Template,
  agency: { id: string; slug: string; name: string },
  token: string,
) {
  const vars = {
    agency_name: agency.name,
    profile_url: absoluteUrl(`/agency/${agency.slug}`),
    claim_url: claimLink(agency.slug, token),
    unsubscribe_url: unsubscribeUrl(agency.id),
    sender_name: settings.senderName,
    business_address: settings.businessAddress,
  };
  const t = settings.templates[template];
  const text = `${renderTemplate(t.body, vars)}\nRemove my listing: ${removeListingUrl(agency.id)}\n`;
  return {
    subject: renderTemplate(t.subject, vars).replace(/[\r\n]+/g, " ").slice(0, 150),
    text,
    html: textToHtml(text),
    unsubscribe: vars.unsubscribe_url,
  };
}

/** Sends one message through Resend from the outreach address. */
async function deliver(settings: Settings, to: string, email: ReturnType<typeof composeEmail>) {
  const mailer = getMailer();
  if (!mailer) return { id: null, error: "Email isn't configured (RESEND_API_KEY)." };
  const mailto = settings.replyTo || settings.from;
  const { data, error } = await mailer.send({
    from: `${settings.senderName} <${settings.from}>`,
    to,
    replyTo: settings.replyTo || settings.from,
    subject: email.subject,
    text: email.text,
    html: email.html,
    headers: {
      "List-Unsubscribe": `<mailto:${mailto}?subject=unsubscribe>, <${email.unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  return { id: data?.id ?? null, error: error ? String(error.message ?? "send failed").slice(0, 300) : null };
}

/** The send-time checks for a set of agencies, by agency id. */
async function recipients(db: Db, agencyIds: string[]) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [agencies, contacts, leads] = await Promise.all([
    db.from("agencies").select("id, slug, name, status, is_claimed").in("id", agencyIds),
    db.from("agency_outreach_contacts").select("agency_id, email, opted_out_at").in("agency_id", agencyIds),
    db.from("agency_outreach").select("agency_id").in("agency_id", agencyIds).gte("sent_at", weekAgo),
  ]);
  for (const r of [agencies, contacts, leads]) if (r.error) throw r.error;
  const emails = [...new Set(contacts.data!.map((c) => c.email.toLowerCase()))];
  const { data: suppressed, error } = emails.length
    ? await db.from("outreach_suppressions").select("email").in("email", emails)
    : { data: [], error: null };
  if (error) throw error;
  const banned = new Set(suppressed.map((s) => s.email));
  const contactOf = new Map(contacts.data!.map((c) => [c.agency_id, c]));
  const recent = new Set(leads.data!.map((l) => l.agency_id));
  return new Map(
    agencies.data!.map((a) => {
      const c = contactOf.get(a.id);
      const email = c?.email.toLowerCase() ?? null;
      const reason = !email
        ? "no email address"
        : blockedReason({
            status: a.status,
            isClaimed: a.is_claimed,
            optedOut: !!c?.opted_out_at,
            suppressed: banned.has(email),
            recentLeadEmail: recent.has(a.id),
          });
      return [a.id, { agency: a, email, reason }];
    }),
  );
}

/** Queues invites for the given agencies (one batch). Skips any that can't be emailed. */
export async function queueInvites(db: Db, agencyIds: string[]) {
  const checks = await recipients(db, agencyIds);
  const { data: existing, error } = await db
    .from("outreach_messages")
    .select("agency_id")
    .in("agency_id", agencyIds)
    .eq("template", "invite");
  if (error) throw error;
  const invited = new Set(existing.map((e) => e.agency_id));
  const batchId = crypto.randomUUID();
  const rows = [...checks.values()]
    .filter((c) => !c.reason && c.email && !invited.has(c.agency.id))
    .map((c) => ({ agency_id: c.agency.id, email: c.email!, template: "invite", token: newToken(), batch_id: batchId }));
  if (rows.length) {
    const { error: e } = await db
      .from("outreach_messages")
      .upsert(rows, { onConflict: "agency_id,template", ignoreDuplicates: true });
    if (e) throw e;
  }
  return { queued: rows.length, skipped: agencyIds.length - rows.length, batchId };
}

/** Reminders for delivered invites older than the delay (agency still emailable). */
async function queueReminders(db: Db, settings: Settings, now: Date) {
  const cutoff = new Date(now.getTime() - settings.reminderDays * 86_400_000).toISOString();
  const { data: invites, error } = await db
    .from("outreach_messages")
    .select("agency_id, status, delivered_at, batch_id")
    .eq("template", "invite")
    .eq("status", "delivered")
    .lte("delivered_at", cutoff)
    .limit(500);
  if (error) throw error;
  const due = invites.filter((i) =>
    reminderDue({ status: i.status, deliveredAt: i.delivered_at }, now, settings.reminderDays),
  );
  if (!due.length) return 0;
  const { data: reminded } = await db
    .from("outreach_messages")
    .select("agency_id")
    .eq("template", "reminder")
    .in("agency_id", due.map((d) => d.agency_id));
  const done = new Set((reminded ?? []).map((r) => r.agency_id));
  const checks = await recipients(db, due.map((d) => d.agency_id).filter((id) => !done.has(id)));
  const rows = [...checks.values()]
    .filter((c) => !c.reason && c.email)
    .map((c) => ({
      agency_id: c.agency.id,
      email: c.email!,
      template: "reminder",
      token: newToken(),
      batch_id: due.find((d) => d.agency_id === c.agency.id)?.batch_id ?? null,
    }));
  if (rows.length) {
    const { error: e } = await db
      .from("outreach_messages")
      .upsert(rows, { onConflict: "agency_id,template", ignoreDuplicates: true });
    if (e) throw e;
  }
  return rows.length;
}

/** One cron run. Returns counts only (no addresses). */
export async function runOutreach(now = new Date()) {
  const db = createAdminClient();
  const settings = await getOutreachSettings(db);
  const problems = sendingProblems(settings);
  if (problems.length) return { sent: 0, failed: 0, cancelled: 0, reminders: 0, problems };

  const reminders = await queueReminders(db, settings, now);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { count: sentToday, error: countError } = await db
    .from("outreach_messages")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", dayStart);
  if (countError) throw countError;
  const quota = runQuota(settings.dailyCap, sentToday ?? 0, now);
  if (!quota) return { sent: 0, failed: 0, cancelled: 0, reminders, problems: [] };

  const { data: queued, error } = await db
    .from("outreach_messages")
    .select("id, agency_id, template, token")
    .eq("status", "queued")
    .order("queued_at")
    .limit(quota);
  if (error) throw error;
  const checks = queued.length ? await recipients(db, queued.map((q) => q.agency_id)) : new Map();
  let sent = 0;
  let failed = 0;
  let cancelled = 0;
  for (const m of queued) {
    const c = checks.get(m.agency_id);
    if (!c || c.reason || !c.email) {
      await db
        .from("outreach_messages")
        .update({ status: "cancelled", error: c?.reason ?? "agency removed" })
        .eq("id", m.id)
        .eq("status", "queued");
      cancelled++;
      continue;
    }
    // Claim the row before sending, so an overlapping run can't send it twice.
    const { data: claimed } = await db
      .from("outreach_messages")
      .update({ status: "sent", sent_at: new Date().toISOString(), email: c.email })
      .eq("id", m.id)
      .eq("status", "queued")
      .select("id");
    if (!claimed?.length) continue;
    const res = await deliver(settings, c.email, composeEmail(settings, m.template as Template, c.agency, m.token));
    if (res.error || !res.id) {
      failed++;
      await db.from("outreach_messages").update({ status: "failed", error: res.error }).eq("id", m.id);
    } else {
      sent++;
      await db.from("outreach_messages").update({ resend_id: res.id }).eq("id", m.id);
    }
  }
  return { sent, failed, cancelled, reminders, problems: [] };
}

/** "Send test to me": the template for a real agency, to the admin, with a dummy token. */
export async function sendTest(template: Template, agency: { id: string; slug: string; name: string }, to: string) {
  const settings = await getOutreachSettings();
  if (!settings.from || !settings.businessAddress.trim())
    return "Set the From address and the business postal address first.";
  const email = composeEmail(settings, template, agency, "test-link-not-tracked-000000000000");
  const res = await deliver(settings, to, { ...email, subject: `[Test] ${email.subject}` });
  return res.error;
}

/** Resend webhook: delivered / bounced / complained. Bounces and complaints suppress the address. */
export async function applyWebhookEvent(resendId: string, status: "delivered" | "bounced" | "complained", at: string) {
  const db = createAdminClient();
  const { data: msg } = await db
    .from("outreach_messages")
    .select("id, email, status")
    .eq("resend_id", resendId)
    .maybeSingle();
  if (!msg) return false; // not an outreach email (lead emails share the Resend account)
  // A bounce or complaint wins over an earlier "delivered"; "delivered" never overwrites them.
  if (status === "delivered" && msg.status !== "sent") return true;
  await db
    .from("outreach_messages")
    .update(status === "delivered" ? { status, delivered_at: at } : { status })
    .eq("id", msg.id);
  if (status !== "delivered") {
    await db
      .from("outreach_suppressions")
      .upsert({ email: msg.email.toLowerCase(), reason: status }, { onConflict: "email", ignoreDuplicates: true });
    await db.from("outreach_messages").update({ status: "cancelled", error: status }).eq("email", msg.email).eq("status", "queued");
  }
  return true;
}
