"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import { queueInvites, sendTest } from "@/lib/outreach-mail";
import {
  classifyImport,
  fromOnOutreachDomain,
  normalizeEmail,
  OUTREACH_FROM_DOMAIN,
  parseCsv,
  TEMPLATES,
  type ImportRow,
} from "@/lib/outreach-rules";
import type { FormResult } from "@/lib/validation/lead";

// Admin → Growth → Outreach. Service role after the admin check; every change is logged (ids and
// field names only, never addresses).

type Ctx = NonNullable<Awaited<ReturnType<typeof adminContext>>>;
const PAGE = "/admin/outreach";
const uuid = z.uuid();
const SAVE_FAILED = "We couldn't save that. Please try again.";

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((v) => v === "" || !!normalizeEmail(v), "Enter a valid email address.");
const sendingSchema = z.object({
  senderName: z.string().trim().min(1, "Enter a sender name.").max(80),
  from: optionalEmail.refine(
    (v) => v === "" || fromOnOutreachDomain(v),
    `Use an address on ${OUTREACH_FROM_DOMAIN}, e.g. hello@${OUTREACH_FROM_DOMAIN}.`,
  ),
  replyTo: optionalEmail,
  businessAddress: z.string().trim().max(300, "Use 300 characters or fewer."),
  dailyCap: z.coerce.number().int("Use a whole number.").min(1, "At least 1.").max(200, "At most 200."),
  reminderDays: z.coerce.number().int("Use a whole number.").min(3, "At least 3 days.").max(60, "At most 60 days."),
});
export type OutreachSendingInput = z.input<typeof sendingSchema>;

const templatesSchema = z.object({
  inviteSubject: z.string().trim().min(1, "Enter a subject.").max(150),
  inviteBody: z.string().trim().min(1, "Enter the email text.").max(5000),
  reminderSubject: z.string().trim().min(1, "Enter a subject.").max(150),
  reminderBody: z.string().trim().min(1, "Enter the email text.").max(5000),
});
export type OutreachTemplatesInput = z.input<typeof templatesSchema>;

const invalid = (error: z.ZodError) => {
  const fieldErrors: Record<string, string> = {};
  for (const i of error.issues) fieldErrors[String(i.path[0])] ??= i.message;
  return { ok: false as const, error: "Check the highlighted fields.", fieldErrors };
};

/** Settings tab: sender, addresses, cap and reminder delay. */
export async function saveOutreachSending(raw: unknown): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const parsed = sendingSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const { error } = await ctx.db
    .from("app_settings")
    .update({
      outreach_sender_name: v.senderName,
      outreach_from: v.from,
      outreach_reply_to: v.replyTo,
      outreach_business_address: v.businessAddress,
      outreach_daily_cap: v.dailyCap,
      outreach_reminder_days: v.reminderDays,
    })
    .eq("id", true);
  if (error) return { ok: false, error: SAVE_FAILED };
  await ctx.log("outreach.settings", "app_settings", null, { fields: Object.keys(v) });
  revalidatePath(PAGE);
  return { ok: true, data: undefined };
}

/** Templates tab: the two subjects and bodies. */
export async function saveOutreachTemplates(raw: unknown): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const parsed = templatesSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const { error } = await ctx.db
    .from("app_settings")
    .update({
      outreach_invite_subject: v.inviteSubject,
      outreach_invite_body: v.inviteBody,
      outreach_reminder_subject: v.reminderSubject,
      outreach_reminder_body: v.reminderBody,
    })
    .eq("id", true);
  if (error) return { ok: false, error: SAVE_FAILED };
  await ctx.log("outreach.templates", "app_settings", null, { fields: Object.keys(v) });
  revalidatePath(PAGE);
  return { ok: true, data: undefined };
}

export async function setOutreachPaused(paused: boolean): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const { error } = await ctx.db.from("app_settings").update({ outreach_paused: paused === true }).eq("id", true);
  if (error) return { ok: false, error: SAVE_FAILED };
  await ctx.log(paused ? "outreach.pause" : "outreach.resume", "app_settings", null);
  revalidatePath(PAGE);
  return { ok: true, data: undefined };
}

// ───────── Contacts ─────────

async function claimedOrMissing(ctx: Ctx, agencyId: string) {
  const { data } = await ctx.db.from("agencies").select("is_claimed, status").eq("id", agencyId).maybeSingle();
  if (!data || data.status !== "published") return "That agency isn't published.";
  if (data.is_claimed) return "That agency is claimed: its owner manages it.";
  return null;
}

export async function saveOutreachContact(agencyId: string, rawEmail: string): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(agencyId).success) return { ok: false, error: "Unknown agency." };
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: "Enter a valid email address.", fieldErrors: { email: "Enter a valid email address." } };
  const problem = await claimedOrMissing(ctx, agencyId);
  if (problem) return { ok: false, error: problem };
  // A new address starts subscribed; the same address keeps its opt-out.
  const { data: current } = await ctx.db
    .from("agency_outreach_contacts")
    .select("email")
    .eq("agency_id", agencyId)
    .maybeSingle();
  const { error } = await ctx.db.from("agency_outreach_contacts").upsert(
    { agency_id: agencyId, email, ...(current && current.email !== email ? { opted_out_at: null } : {}) },
    { onConflict: "agency_id" },
  );
  if (error) return { ok: false, error: SAVE_FAILED };
  await ctx.log("outreach.contact_save", "agency", agencyId);
  revalidatePath(PAGE);
  return { ok: true, data: undefined };
}

export async function removeOutreachContact(agencyId: string): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(agencyId).success) return { ok: false, error: "Unknown agency." };
  const { error } = await ctx.db.from("agency_outreach_contacts").delete().eq("agency_id", agencyId);
  if (error) return { ok: false, error: SAVE_FAILED };
  await ctx.db
    .from("outreach_messages")
    .update({ status: "cancelled", error: "address removed" })
    .eq("agency_id", agencyId)
    .eq("status", "queued");
  await ctx.log("outreach.contact_remove", "agency", agencyId);
  revalidatePath(PAGE);
  return { ok: true, data: undefined };
}

async function classify(ctx: Ctx, csv: string) {
  const rows = parseCsv(csv);
  const slugs = [...new Set(rows.map((r) => r.slug))].filter((s) => /^[a-z0-9-]{1,80}$/.test(s));
  const agencies = new Map<string, { id: string; isClaimed: boolean; status: string }>();
  for (let i = 0; i < slugs.length; i += 200) {
    const { data, error } = await ctx.db
      .from("agencies")
      .select("id, slug, is_claimed, status")
      .in("slug", slugs.slice(i, i + 200));
    if (error) throw error;
    for (const a of data) agencies.set(a.slug, { id: a.id, isClaimed: a.is_claimed, status: a.status });
  }
  const ids = [...agencies.values()].map((a) => a.id);
  const existing = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await ctx.db
      .from("agency_outreach_contacts")
      .select("agency_id, email")
      .in("agency_id", ids.slice(i, i + 200));
    if (error) throw error;
    for (const c of data) existing.set(c.agency_id, c.email.toLowerCase());
  }
  return classifyImport(rows, agencies, existing);
}

/** The import preview: what saving would do, row by row. Saves nothing. */
export async function previewContactImport(csv: string): Promise<FormResult<ImportRow[]>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (typeof csv !== "string" || csv.length > 500_000) return { ok: false, error: "That file is too big (500 KB max)." };
  try {
    return { ok: true, data: await classify(ctx, csv) };
  } catch {
    return { ok: false, error: "We couldn't read that file." };
  }
}

/** Saves the matched and updated rows (re-checked on the server; the preview isn't trusted). */
export async function importContacts(csv: string): Promise<FormResult<{ saved: number }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (typeof csv !== "string" || csv.length > 500_000) return { ok: false, error: "That file is too big (500 KB max)." };
  const rows = (await classify(ctx, csv)).filter((r) => r.status === "matched" || r.status === "updated");
  if (!rows.length) return { ok: false, error: "Nothing to save." };
  const { error } = await ctx.db.from("agency_outreach_contacts").upsert(
    rows.map((r) => ({
      agency_id: r.agencyId!,
      email: r.normalized!,
      ...(r.status === "updated" ? { opted_out_at: null } : {}),
    })),
    { onConflict: "agency_id" },
  );
  if (error) return { ok: false, error: SAVE_FAILED };
  await ctx.log("outreach.contact_import", "agency", null, { rows: rows.length });
  revalidatePath(PAGE);
  return { ok: true, data: { saved: rows.length } };
}

// ───────── Queue and test ─────────

export async function queueOutreachInvites(agencyIds: string[]): Promise<FormResult<{ queued: number; skipped: number }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const ids = z.array(uuid).min(1).max(500).safeParse(agencyIds);
  if (!ids.success) return { ok: false, error: "Choose at least one agency." };
  try {
    const { queued, skipped, batchId } = await queueInvites(ctx.db, ids.data);
    await ctx.log("outreach.queue", "outreach_batch", batchId, { queued, skipped });
    revalidatePath(PAGE);
    return { ok: true, data: { queued, skipped } };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

export async function sendOutreachTest(template: string, agencyId: string): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const t = z.enum(TEMPLATES).safeParse(template);
  if (!t.success || !uuid.safeParse(agencyId).success) return { ok: false, error: "Choose a template and an agency." };
  const [{ data: agency }, { data: me }] = await Promise.all([
    ctx.db.from("agencies").select("id, slug, name").eq("id", agencyId).maybeSingle(),
    ctx.db.auth.admin.getUserById(ctx.adminId),
  ]);
  const to = me.user?.email;
  if (!agency || !to) return { ok: false, error: "We couldn't find that agency or your email." };
  const error = await sendTest(t.data, agency, to);
  if (error) return { ok: false, error };
  await ctx.log("outreach.test", "agency", agencyId, { template: t.data });
  return { ok: true, data: undefined };
}
