import "server-only";

import {
  PaymentFailedEmail,
  ProEndedEmail,
  ProEndingEmail,
  ProStartedEmail,
} from "@/emails/billing";
import type { Email } from "@/lib/billing/events";
import { getMailer } from "@/lib/email";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// Billing emails to the agency owner: from the webhook (started, payment failed, ended) and the
// daily cron ("Pro ends in 3 days" for scheduled cancels).

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

async function ownerEmail(ownerId: string | null) {
  if (!ownerId) return null;
  const { data } = await createAdminClient().auth.admin.getUserById(ownerId);
  return data.user?.email ?? null;
}

export async function sendBillingEmail(
  agency: { id: string; slug: string; name: string; owner_id: string | null },
  kind: Email | "ending",
  endsAt?: string,
) {
  const mail = getMailer();
  const to = await ownerEmail(agency.owner_id);
  if (!mail || !to) return false;
  const props = {
    agencyName: agency.name,
    billingUrl: absoluteUrl(`/dashboard/${agency.slug}/billing`),
  };
  const message =
    kind === "welcome"
      ? { subject: "You're on Pro", react: <ProStartedEmail {...props} /> }
      : kind === "payment_failed"
        ? { subject: "Payment failed: update your card", react: <PaymentFailedEmail {...props} /> }
        : kind === "ending"
          ? {
              subject: "Your Pro plan ends in 3 days",
              react: <ProEndingEmail {...props} endsOn={longDate(endsAt!)} />,
            }
          : { subject: "Your Pro plan has ended", react: <ProEndedEmail {...props} /> };
  const { error } = await mail.send({ from: mail.from, to, ...message });
  if (error) throw new Error("send failed");
  return true;
}

const DAY = 86_400_000;

/**
 * "Pro ends in 3 days": once per scheduled cancel (ending_notice_sent_at), for subscriptions
 * ending in the next 3 days. Daily cron.
 */
export async function sendEndingNotices() {
  if (!getMailer()) return { sent: 0, skipped: "email not configured" };
  const db = createAdminClient();
  const now = Date.now();
  const { data, error } = await db
    .from("agency_subscriptions")
    .select("id, ends_at, agencies(id, slug, name, owner_id)")
    .eq("status", "active")
    .eq("cancel_at_period_end", true)
    .is("ending_notice_sent_at", null)
    .gt("ends_at", new Date(now).toISOString())
    .lte("ends_at", new Date(now + 3 * DAY).toISOString());
  if (error) throw error;
  let sent = 0;
  for (const s of data) {
    if (!s.agencies || !s.ends_at) continue;
    try {
      if (!(await sendBillingEmail(s.agencies, "ending", s.ends_at))) continue;
    } catch {
      console.error("ending notice failed", { subscriptionId: s.id });
      continue;
    }
    await db
      .from("agency_subscriptions")
      .update({ ending_notice_sent_at: new Date().toISOString() })
      .eq("id", s.id);
    sent++;
  }
  return { sent };
}
