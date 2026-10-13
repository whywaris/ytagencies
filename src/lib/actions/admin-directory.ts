"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { NotApprovedEmail } from "@/emails/not-approved";
import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import { removeCaseStudy, resolveCaseStudyChannels, writeCaseStudy } from "@/lib/case-studies";
import { approveClaim } from "@/lib/claims";
import { getMailer, oneLine } from "@/lib/email";
import { revalidateAgency } from "@/lib/revalidate";
import type { Json } from "@/lib/supabase/types";
import { caseStudySchema } from "@/lib/validation/dashboard";
import type { FormResult } from "@/lib/validation/lead";
import { fetchChannel, withCheck, type ChannelResult, type ChannelStats } from "@/lib/youtube";
import { parseChannelUrl } from "@/lib/youtube-url";

// Admin directory mutations (ADMIN_V2_SPEC §5.2–5.4). Each checks the admin role, writes with the
// service role, and logs to admin_actions. Arguments are validated: bound ids can be tampered with.

const uuid = z.uuid();
const SAVE_FAILED = "We couldn't save that. Please try again.";
const reasonSchema = z.string().trim().max(1000, "Keep the reason under 1,000 characters.");

type Ctx = NonNullable<Awaited<ReturnType<typeof adminContext>>>;

// ───────── Agencies: status and plan ─────────

const statusSchema = z.enum(["published", "draft", "archived"]);

/** Publish, unpublish (back to draft) or archive one or more agencies. */
export async function setAgenciesStatus(
  ids: string[],
  status: string,
): Promise<FormResult<{ count: number }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const parsedIds = z.array(uuid).min(1).max(100).safeParse(ids);
  const s = statusSchema.safeParse(status);
  if (!parsedIds.success || !s.success) return { ok: false, error: "Nothing to change." };

  const { data, error } = await ctx.db
    .from("agencies")
    .update({ status: s.data, updated_at: new Date().toISOString() })
    .in("id", parsedIds.data)
    .select("id, slug");
  if (error) return { ok: false, error: SAVE_FAILED };
  const action = {
    published: "agency.publish",
    draft: "agency.unpublish",
    archived: "agency.archive",
  }[s.data];
  for (const a of data) {
    await ctx.log(action, "agency", a.id, parsedIds.data.length > 1 ? { bulk: true } : {});
    revalidateAgency(a.slug); // unpublishing must drop it from cached pages too
  }
  revalidatePath("/admin/agencies");
  return { ok: true, data: { count: data.length } };
}

const MEDIA_BUCKET = "agency-media";

/** Removes every file under a storage folder (agencies/<id>/), subfolders included. */
async function removeFolder(ctx: Ctx, prefix: string): Promise<void> {
  const { data, error } = await ctx.db.storage.from(MEDIA_BUCKET).list(prefix, { limit: 1000 });
  if (error || !data?.length) return;
  // Entries without an id are subfolders.
  await Promise.all(data.filter((f) => !f.id).map((d) => removeFolder(ctx, `${prefix}/${d.name}`)));
  const files = data.filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
  if (files.length) await ctx.db.storage.from(MEDIA_BUCKET).remove(files);
}

/**
 * Permanently deletes agencies. One database transaction (delete_agencies) keeps their leads,
 * copying each lead's route with the agency's name first, and removes everything else about
 * them; their uploaded files go after it succeeds. Logged with id, name and slug only.
 */
export async function deleteAgencies(
  ids: string[],
): Promise<FormResult<{ count: number; name: string | null }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const parsed = z.array(uuid).min(1).max(100).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Nothing to delete." };

  const { data, error } = await ctx.db.rpc("delete_agencies", { p_ids: parsed.data });
  if (error) return { ok: false, error: "We couldn't delete that. Nothing was changed." };

  for (const a of data) {
    await ctx.log("agency.delete", "agency", a.id, { name: a.name, slug: a.slug });
    revalidateAgency(a.slug);
  }
  // Storage after the commit: a failure here leaves orphaned files, never a half-deleted agency.
  await Promise.all(
    data.map((a) =>
      removeFolder(ctx, `agencies/${a.id}`).catch(() =>
        console.error("agency files not removed", { agencyId: a.id }),
      ),
    ),
  );
  revalidatePath("/sitemaps/agencies.xml");
  revalidatePath("/sitemaps/categories.xml");
  revalidatePath("/about");
  revalidatePath("/admin/agencies");
  return { ok: true, data: { count: data.length, name: data.length === 1 ? data[0].name : null } };
}

const planSchema = z.object({
  // "free" = no subscription: the listing becomes unmanaged.
  plan: z.enum(["free", "pro"]),
  // yyyy-mm-dd from a date input; empty = no end date
  endsOn: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Pick a date.")
    .refine(
      (v) => !v || new Date(`${v}T00:00:00Z`) > new Date(),
      "The end date must be in the future.",
    ),
});

/**
 * Manual plan change: ends the current live subscription (cancelled) and, for Pro, starts a new one
 * now (source "manual"). "free" leaves the agency unmanaged: still listed, editing and inquiries off.
 */
export async function changePlan(agencyId: string, raw: unknown): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(agencyId).success) return { ok: false, error: "Unknown agency." };
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the plan.",
      fieldErrors: {},
    };
  }
  const { plan, endsOn } = parsed.data;
  const { data: agency } = await ctx.db
    .from("agencies")
    .select("slug")
    .eq("id", agencyId)
    .maybeSingle();
  if (!agency) return { ok: false, error: "Unknown agency." };
  const now = new Date().toISOString();
  const { error: endError } = await ctx.db
    .from("agency_subscriptions")
    .update({ status: "cancelled", ends_at: now })
    .eq("agency_id", agencyId)
    .in("status", ["active", "past_due"]);
  if (endError) return { ok: false, error: SAVE_FAILED };
  if (plan !== "free") {
    const { error } = await ctx.db.from("agency_subscriptions").insert({
      agency_id: agencyId,
      plan_id: plan,
      status: "active",
      starts_at: now,
      ends_at: endsOn ? `${endsOn}T23:59:59Z` : null,
      source: "manual",
    });
    if (error) return { ok: false, error: SAVE_FAILED };
  }
  await ctx.log("agency.change_plan", "agency", agencyId, { plan, ends_on: endsOn || null });
  revalidateAgency(agency.slug);
  revalidatePath("/admin/agencies");
  revalidatePath(`/admin/agencies/${agencyId}`);
  return { ok: true, data: undefined };
}

// ───────── Queues: submissions, claims, reviews ─────────

/** Emails the account behind a rejected item, if there is one and email is configured. */
async function emailRejection(ctx: Ctx, userId: string | null, what: string, reason: string) {
  const mail = getMailer();
  if (!mail || !userId) return;
  const { data } = await ctx.db.auth.admin.getUserById(userId);
  const to = data.user?.email;
  if (!to) return;
  after(() =>
    mail
      .send({
        from: mail.from,
        to,
        subject: oneLine(`${what} wasn't approved`),
        react: NotApprovedEmail({ what, reason: reason || null }),
      })
      .then(({ error }) => error && console.error("rejection email failed")),
  );
}

const decisionSchema = z.enum(["approve", "reject"]);

/**
 * New agencies from /list-your-agency. Approve publishes the draft and, if nobody owns it yet,
 * approves the submitter's pending claim (the admin's review stands in for the domain check).
 * Reject deletes the draft (claims cascade) and emails the submitter, with the reason if given.
 */
export async function decideSubmission(
  agencyId: string,
  decision: string,
  reason = "",
): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const d = decisionSchema.safeParse(decision);
  const r = reasonSchema.safeParse(reason);
  if (!uuid.safeParse(agencyId).success || !d.success)
    return { ok: false, error: "Unknown submission." };
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const { data: agency } = await ctx.db
    .from("agencies")
    .select("id, name, slug, status, owner_id, submitted_by")
    .eq("id", agencyId)
    .maybeSingle();
  if (!agency || agency.status !== "draft" || !agency.submitted_by) {
    return { ok: false, error: "This submission was already decided." };
  }

  if (d.data === "reject") {
    const { error } = await ctx.db
      .from("agencies")
      .delete()
      .eq("id", agency.id)
      .eq("status", "draft");
    if (error) return { ok: false, error: SAVE_FAILED };
    await ctx.log("submission.reject", "agency", agency.id, {
      slug: agency.slug,
      reason: r.data || null,
    });
    await emailRejection(ctx, agency.submitted_by, `Your listing for ${agency.name}`, r.data);
  } else {
    if (!agency.owner_id) {
      const { data: claim } = await ctx.db
        .from("claims")
        .select("id")
        .eq("agency_id", agency.id)
        .eq("user_id", agency.submitted_by)
        .eq("status", "pending")
        .maybeSingle();
      if (claim)
        await approveClaim({ id: claim.id, agencyId: agency.id, userId: agency.submitted_by });
    }
    const { error } = await ctx.db
      .from("agencies")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("id", agency.id);
    if (error) return { ok: false, error: SAVE_FAILED };
    await ctx.log("submission.approve", "agency", agency.id);
    revalidateAgency(agency.slug);
  }
  revalidatePath("/admin/submissions");
  return { ok: true, data: undefined };
}

export async function decideClaim(
  claimId: string,
  decision: string,
  reason = "",
): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const d = decisionSchema.safeParse(decision);
  const r = reasonSchema.safeParse(reason);
  if (!uuid.safeParse(claimId).success || !d.success) return { ok: false, error: "Unknown claim." };
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const { data: claim } = await ctx.db
    .from("claims")
    .select("id, agency_id, user_id, status, agencies(name, slug)")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim || claim.status !== "pending")
    return { ok: false, error: "This claim was already decided." };

  if (d.data === "approve") {
    if (!(await approveClaim({ id: claim.id, agencyId: claim.agency_id, userId: claim.user_id }))) {
      return { ok: false, error: "This listing was claimed by someone else in the meantime." };
    }
    await ctx.log("claim.approve", "claim", claim.id, { agency_id: claim.agency_id });
    if (claim.agencies) revalidateAgency(claim.agencies.slug);
  } else {
    const { error } = await ctx.db
      .from("claims")
      .update({ status: "rejected" })
      .eq("id", claim.id)
      .eq("status", "pending");
    if (error) return { ok: false, error: SAVE_FAILED };
    await ctx.log("claim.reject", "claim", claim.id, {
      agency_id: claim.agency_id,
      reason: r.data || null,
    });
    await emailRejection(
      ctx,
      claim.user_id,
      `Your claim for ${claim.agencies?.name ?? "a listing"}`,
      r.data,
    );
  }
  revalidatePath("/admin/claims");
  return { ok: true, data: undefined };
}

export async function decideReview(
  reviewId: string,
  decision: string,
  reason = "",
): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const d = decisionSchema.safeParse(decision);
  const r = reasonSchema.safeParse(reason);
  if (!uuid.safeParse(reviewId).success || !d.success)
    return { ok: false, error: "Unknown review." };
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const status = d.data === "approve" ? "published" : "rejected";
  const { data } = await ctx.db
    .from("reviews")
    .update({ status })
    .eq("id", reviewId)
    .eq("status", "pending")
    .select("author_id, agencies(name, slug)")
    .maybeSingle();
  if (!data) return { ok: false, error: "This review was already moderated." };
  await ctx.log(
    status === "published" ? "review.publish" : "review.reject",
    "review",
    reviewId,
    status === "rejected" ? { reason: r.data || null } : {},
  );
  // Reviews only have an email when they're linked to an account.
  if (status === "rejected") {
    await emailRejection(
      ctx,
      data.author_id,
      `Your review of ${data.agencies?.name ?? "an agency"}`,
      r.data,
    );
  }
  if (data.agencies) revalidateAgency(data.agencies.slug);
  revalidatePath("/admin/reviews");
  return { ok: true, data: undefined };
}

// ───────── Verification ─────────

/** Looks up each pasted channel URL with the YouTube Data API. Nothing is saved. */
export async function lookupChannels(urls: string[]): Promise<FormResult<ChannelResult[]>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const list = z.array(z.string().max(300)).max(10).safeParse(urls);
  if (!list.success) return { ok: false, error: "Paste up to 10 channel URLs, one per line." };
  const inputs = list.data.map((u) => u.trim()).filter(Boolean);
  if (!inputs.length) return { ok: false, error: "Paste at least one channel URL." };
  const results = await Promise.all(
    inputs.map(async (input): Promise<ChannelResult> => {
      const parsed = parseChannelUrl(input);
      if (!parsed.ok) return { input, ok: false, error: parsed.error };
      const stats = await fetchChannel(parsed.ref);
      return typeof stats === "string"
        ? { input, ok: false, error: stats }
        : { input, ok: true, stats };
    }),
  );
  return { ok: true, data: results };
}

const statsSchema = z.object({
  channelId: z.string().regex(/^UC[\w-]{22}$/),
  title: z.string().max(200),
  url: z.url(),
  subscribers: z.number().int().nonnegative().nullable(),
  views: z.number().int().nonnegative(),
  videos: z.number().int().nonnegative(),
  publishedAt: z.string().max(40),
});

const verificationSchema = z
  .object({
    decision: decisionSchema,
    channels: z.array(statsSchema).max(10),
    checklist: z.object({
      ownership: z.boolean(),
      domain: z.boolean(),
      business: z.boolean(),
    }),
    reason: reasonSchema,
  })
  .refine(
    (v) =>
      v.decision === "reject" ||
      (v.channels.length > 0 &&
        v.checklist.ownership &&
        v.checklist.domain &&
        v.checklist.business),
    { message: "To approve, look up at least one channel and tick every check." },
  );

/**
 * Approves or rejects verification for an agency (§5.4). Updates its open request if there is
 * one, otherwise records a new verification. The badge follows approved rows (DB trigger).
 * Stats are re-fetched on the server: the snapshot never trusts numbers sent from the browser.
 */
export async function saveVerification(agencyId: string, raw: unknown): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(agencyId).success) return { ok: false, error: "Unknown agency." };
  const parsed = verificationSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  const { data: agency } = await ctx.db
    .from("agencies")
    .select("slug")
    .eq("id", agencyId)
    .maybeSingle();
  if (!agency) return { ok: false, error: "Unknown agency." };

  let channels: ChannelStats[] = [];
  if (v.channels.length) {
    const fresh = await Promise.all(
      v.channels.map((c) => fetchChannel({ kind: "id", value: c.channelId })),
    );
    const failed = fresh.find((f) => typeof f === "string");
    if (failed) return { ok: false, error: `Couldn't confirm the channel stats: ${failed}` };
    channels = fresh as ChannelStats[];
  }

  const now = new Date().toISOString();
  const row = {
    status: v.decision === "approve" ? "approved" : "rejected",
    channels: channels.map((c) => ({ channelId: c.channelId, title: c.title, url: c.url })) as Json,
    stats_snapshot: (channels.length ? withCheck(null, channels) : null) as Json,
    checklist: { ...v.checklist, reason: v.reason || null } as Json,
    reviewed_by: ctx.adminId,
    reviewed_at: now,
  };
  const { data: open } = await ctx.db
    .from("verifications")
    .update(row)
    .eq("agency_id", agencyId)
    .eq("status", "requested")
    .select("id");
  if (!open?.length) {
    const { error } = await ctx.db.from("verifications").insert({ agency_id: agencyId, ...row });
    if (error) return { ok: false, error: SAVE_FAILED };
  }
  if (v.decision === "approve") {
    // The hero shows case-study channels that match these stats, by stored channel ID.
    await resolveCaseStudyChannels(ctx.db, agencyId);
    // Only the newest approval stands; older ones are superseded.
    await ctx.db
      .from("verifications")
      .update({ status: "rejected" })
      .eq("agency_id", agencyId)
      .eq("status", "approved")
      .lt("reviewed_at", now);
  }
  await ctx.log(
    v.decision === "approve" ? "verification.approve" : "verification.reject",
    "agency",
    agencyId,
    {
      channels: channels.map((c) => c.channelId),
      reason: v.reason || null,
    },
  );
  revalidateAgency(agency.slug);
  revalidatePath("/admin/verification");
  revalidatePath(`/admin/agencies/${agencyId}`);
  return { ok: true, data: undefined };
}

/** Removes the Verified badge: the current approval is marked rejected. */
export async function revokeVerification(agencyId: string, reason = ""): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const r = reasonSchema.safeParse(reason);
  if (!uuid.safeParse(agencyId).success || !r.success)
    return { ok: false, error: "Unknown agency." };
  const { data: agency } = await ctx.db
    .from("agencies")
    .select("slug")
    .eq("id", agencyId)
    .maybeSingle();
  if (!agency) return { ok: false, error: "Unknown agency." };
  const { error } = await ctx.db
    .from("verifications")
    .update({ status: "rejected", reviewed_by: ctx.adminId, reviewed_at: new Date().toISOString() })
    .eq("agency_id", agencyId)
    .eq("status", "approved");
  if (error) return { ok: false, error: SAVE_FAILED };
  await ctx.log("verification.revoke", "agency", agencyId, { reason: r.data || null });
  revalidateAgency(agency.slug);
  revalidatePath("/admin/verification");
  revalidatePath(`/admin/agencies/${agencyId}`);
  return { ok: true, data: undefined };
}

// ───────── Case studies (admin) ─────────

export async function adminSaveCaseStudy(
  agencyId: string,
  raw: unknown,
): Promise<FormResult<{ id: string }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(agencyId).success) return { ok: false, error: "Unknown agency." };
  const parsed = caseStudySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }
  const { data: agency } = await ctx.db
    .from("agencies")
    .select("slug")
    .eq("id", agencyId)
    .maybeSingle();
  if (!agency) return { ok: false, error: "Unknown agency." };
  const res = await writeCaseStudy(ctx.db, agencyId, parsed.data);
  if (!res.ok) return res;
  await ctx.log(parsed.data.id ? "case_study.update" : "case_study.create", "agency", agencyId, {
    case_study_id: res.id,
  });
  revalidateAgency(agency.slug);
  return { ok: true, data: { id: res.id } };
}

export async function adminDeleteCaseStudy(
  agencyId: string,
  caseStudyId: string,
): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(agencyId).success || !uuid.safeParse(caseStudyId).success) {
    return { ok: false, error: "Unknown case study." };
  }
  const { data: agency } = await ctx.db
    .from("agencies")
    .select("slug")
    .eq("id", agencyId)
    .maybeSingle();
  if (!agency) return { ok: false, error: "Unknown agency." };
  if (!(await removeCaseStudy(ctx.db, agencyId, caseStudyId)))
    return { ok: false, error: SAVE_FAILED };
  await ctx.log("case_study.delete", "agency", agencyId, { case_study_id: caseStudyId });
  revalidateAgency(agency.slug);
  return { ok: true, data: undefined };
}
