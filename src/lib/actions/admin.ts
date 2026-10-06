"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { applyProfile } from "@/lib/agency-profile";
import { adminLogger } from "@/lib/admin-log";
import { getAdminUser } from "@/lib/auth";
import { approveClaim } from "@/lib/claims";
import { revalidateAgency, revalidateDirectory } from "@/lib/revalidate";
import { createAdminClient } from "@/lib/supabase/admin";
import { agencySchema, comboContentSchema, introSchema } from "@/lib/validation/admin";
import { profileSchema } from "@/lib/validation/dashboard";
import type { FormResult } from "@/lib/validation/lead";

// Admin mutations. Every action checks the admin role first (SECURITY.md), then writes with the
// service role: admin-only columns (status, flags) are blocked for normal users by column grants.
// Arguments are validated too, since bound ids from forms can be tampered with.

const NOT_ADMIN = "You need admin access for this.";
const SAVE_FAILED = "We couldn't save that. Please try again.";
const uuid = z.uuid();

/** After the admin check: the service-role client and an audit logger for this admin, or null. */
async function adminContext() {
  const admin = await getAdminUser();
  if (!admin) return null;
  const db = createAdminClient();
  return { db, adminId: admin.id, log: adminLogger(db, admin.id) };
}

/** For plain <form action> buttons: no UI for errors, so refuse loudly. */
async function adminContextOrThrow() {
  const ctx = await adminContext();
  if (!ctx) throw new Error(NOT_ADMIN);
  return ctx;
}

function invalid(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { ok: false as const, error: "Check the highlighted fields.", fieldErrors };
}

// ───────── Agencies ─────────

/** Creates (id = null) or updates an agency's core fields. Slugs are locked once published. */
export async function saveAgency(
  id: string | null,
  raw: unknown,
): Promise<FormResult<{ id: string }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const { db, log } = ctx;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Unknown agency." };
  const parsed = agencySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  let hqLocationId: number | null = null;
  if (input.hqLocation) {
    const { data } = await db
      .from("locations")
      .select("id")
      .eq("slug", input.hqLocation)
      .maybeSingle();
    if (!data)
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: { hqLocation: "Unknown location." },
      };
    hqLocationId = data.id;
  }
  const row = {
    name: input.name,
    slug: input.slug,
    tagline: input.tagline || null,
    website: input.website || null,
    founded_year: input.foundedYear ? Number(input.foundedYear) : null,
    team_size: input.teamSize || null,
    languages: input.languages
      ? input.languages
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean)
      : [],
    hq_location_id: hqLocationId,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data: current } = await db
      .from("agencies")
      .select("slug, status")
      .eq("id", id)
      .maybeSingle();
    if (!current) return { ok: false, error: "Unknown agency." };
    if (current.status === "published" && current.slug !== input.slug) {
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: {
          slug: "Slugs can't change after publishing. Unpublish first, and add a 301 redirect in next.config.",
        },
      };
    }
    const { error } = await db.from("agencies").update(row).eq("id", id);
    if (error) return slugTaken(error) ?? { ok: false, error: SAVE_FAILED };
    await log("agency.update", "agency", id, {
      fields: Object.keys(row),
      ...(current.slug !== input.slug ? { slug: { from: current.slug, to: input.slug } } : {}),
    });
    revalidateAgency(input.slug);
    if (current.slug !== input.slug) revalidatePath(`/agency/${current.slug}`);
    revalidatePath("/admin/agencies");
    return { ok: true, data: { id } };
  }

  const { data, error } = await db
    .from("agencies")
    .insert({ ...row, status: "draft" })
    .select("id")
    .single();
  if (error || !data) return slugTaken(error) ?? { ok: false, error: SAVE_FAILED };
  await log("agency.create", "agency", data.id, { slug: input.slug });
  revalidatePath("/admin/agencies");
  return { ok: true, data: { id: data.id } };
}

function slugTaken(error: { code?: string } | null) {
  return error?.code === "23505"
    ? {
        ok: false as const,
        error: "Check the highlighted fields.",
        fieldErrors: { slug: "Another agency already uses this slug." },
      }
    : null;
}

export async function adminUpdateProfile(agencyId: string, raw: unknown): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const { db, log } = ctx;
  if (!uuid.safeParse(agencyId).success) return { ok: false, error: "Unknown agency." };
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { data: agency } = await db
    .from("agencies")
    .select("slug")
    .eq("id", agencyId)
    .maybeSingle();
  if (!agency) return { ok: false, error: "Unknown agency." };
  const error = await applyProfile(db, agencyId, parsed.data);
  if (error) return { ok: false, error };
  await log("agency.profile_update", "agency", agencyId);
  revalidateAgency(agency.slug);
  return { ok: true, data: undefined };
}

const statusSchema = z.enum(["published", "draft"]);
const flagSchema = z.enum(["is_verified", "is_featured"]);

export async function setAgencyStatus(id: string, status: string) {
  const { db, log } = await adminContextOrThrow();
  const s = statusSchema.parse(status);
  const { data } = await db
    .from("agencies")
    .update({ status: s, updated_at: new Date().toISOString() })
    .eq("id", uuid.parse(id))
    .select("slug")
    .single();
  if (data) {
    await log(s === "published" ? "agency.publish" : "agency.unpublish", "agency", id);
    revalidateAgency(data.slug); // unpublishing must drop it from cached pages too
  }
  revalidatePath("/admin/agencies");
}

export async function toggleAgencyFlag(id: string, flag: string) {
  const { db, adminId, log } = await adminContextOrThrow();
  const f = flagSchema.parse(flag);
  const { data: current } = await db
    .from("agencies")
    .select("slug, is_verified, is_featured")
    .eq("id", uuid.parse(id))
    .single();
  if (!current) return;
  const now = new Date().toISOString();
  if (f === "is_verified") {
    // The badge follows approved verifications (a DB trigger sets agencies.is_verified).
    // Interim until the Phase 4 verification flow replaces this toggle.
    const review = { reviewed_by: adminId, reviewed_at: now };
    if (current.is_verified) {
      await db
        .from("verifications")
        .update({ status: "rejected", ...review })
        .eq("agency_id", id)
        .eq("status", "approved");
    } else {
      const { data: open } = await db
        .from("verifications")
        .update({ status: "approved", ...review })
        .eq("agency_id", id)
        .eq("status", "requested")
        .select("id");
      if (!open?.length) {
        await db.from("verifications").insert({
          agency_id: id,
          status: "approved",
          checklist: { source: "agencies list" },
          ...review,
        });
      }
    }
    await log(current.is_verified ? "agency.unverify" : "agency.verify", "agency", id);
  } else {
    await db
      .from("agencies")
      .update({ is_featured: !current.is_featured, updated_at: now })
      .eq("id", id);
    await log(current.is_featured ? "agency.unfeature" : "agency.feature", "agency", id);
  }
  revalidateAgency(current.slug);
  revalidatePath("/admin/agencies");
}

// ───────── Claims ─────────

export async function decideClaim(claimId: string, decision: string) {
  const { db, log } = await adminContextOrThrow();
  const d = z.enum(["approve", "reject"]).parse(decision);
  const { data: claim } = await db
    .from("claims")
    .select("id, agency_id, user_id, status, agencies(slug)")
    .eq("id", uuid.parse(claimId))
    .maybeSingle();
  if (!claim || claim.status !== "pending") return;
  if (d === "approve") {
    // false = someone else claimed it first; the claim stays pending for a manual look.
    if (await approveClaim({ id: claim.id, agencyId: claim.agency_id, userId: claim.user_id })) {
      await log("claim.approve", "claim", claim.id, { agency_id: claim.agency_id });
      if (claim.agencies) revalidateAgency(claim.agencies.slug);
    }
  } else {
    await db
      .from("claims")
      .update({ status: "rejected" })
      .eq("id", claim.id)
      .eq("status", "pending");
    await log("claim.reject", "claim", claim.id, { agency_id: claim.agency_id });
  }
  revalidatePath("/admin/claims");
}

// ───────── New submissions (/list-your-agency) ─────────

/**
 * Approve: publish the draft and, if nobody owns it yet, approve the submitter's pending claim
 * (the admin's review stands in for the domain check). Reject: delete the draft; claims cascade.
 */
export async function decideSubmission(agencyId: string, decision: string) {
  const { db, log } = await adminContextOrThrow();
  const d = z.enum(["approve", "reject"]).parse(decision);
  const { data: agency } = await db
    .from("agencies")
    .select("id, slug, status, owner_id, submitted_by")
    .eq("id", uuid.parse(agencyId))
    .maybeSingle();
  if (!agency || agency.status !== "draft" || !agency.submitted_by) return;

  if (d === "reject") {
    await db.from("agencies").delete().eq("id", agency.id).eq("status", "draft");
    await log("submission.reject", "agency", agency.id, { slug: agency.slug });
  } else {
    if (!agency.owner_id) {
      const { data: claim } = await db
        .from("claims")
        .select("id")
        .eq("agency_id", agency.id)
        .eq("user_id", agency.submitted_by)
        .eq("status", "pending")
        .maybeSingle();
      if (claim)
        await approveClaim({ id: claim.id, agencyId: agency.id, userId: agency.submitted_by });
    }
    await db
      .from("agencies")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("id", agency.id);
    await log("submission.approve", "agency", agency.id);
    revalidateAgency(agency.slug);
  }
  revalidatePath("/admin/submissions");
}

// ───────── Reviews ─────────

export async function decideReview(reviewId: string, decision: string) {
  const { db, log } = await adminContextOrThrow();
  const status = z.enum(["published", "rejected"]).parse(decision);
  const { data } = await db
    .from("reviews")
    .update({ status })
    .eq("id", uuid.parse(reviewId))
    .eq("status", "pending")
    .select("agencies(slug)")
    .maybeSingle();
  if (data)
    await log(status === "published" ? "review.publish" : "review.reject", "review", reviewId);
  if (data?.agencies) revalidateAgency(data.agencies.slug);
  revalidatePath("/admin/reviews");
}

// ───────── Taxonomy copy ─────────

export async function saveIntro(kind: string, id: number, raw: unknown): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const { db, log } = ctx;
  const k = z.enum(["services", "industries"]).safeParse(kind);
  if (!k.success || !Number.isInteger(id)) return { ok: false, error: "Unknown item." };
  const parsed = introSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await db
    .from(k.data)
    .update({ intro: parsed.data.intro || null })
    .eq("id", id);
  if (error) return { ok: false, error: SAVE_FAILED };
  await log("taxonomy.intro_update", k.data === "services" ? "service" : "industry", id);
  revalidateDirectory();
  revalidatePath("/admin/taxonomy");
  return { ok: true, data: undefined };
}

export async function saveComboContent(
  serviceId: number,
  industryId: number,
  raw: unknown,
): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const { db, log } = ctx;
  if (!Number.isInteger(serviceId) || !Number.isInteger(industryId))
    return { ok: false, error: "Unknown combination." };
  const parsed = comboContentSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const [{ data: service }, { data: industry }] = await Promise.all([
    db.from("services").select("slug").eq("id", serviceId).maybeSingle(),
    db.from("industries").select("slug").eq("id", industryId).maybeSingle(),
  ]);
  if (!service || !industry) return { ok: false, error: "Unknown combination." };

  const { error } = await db.from("service_industry_content").upsert(
    {
      service_id: serviceId,
      industry_id: industryId,
      intro: parsed.data.intro || null,
      how_to_choose: parsed.data.howToChoose || null,
      faqs: parsed.data.faqs,
    },
    { onConflict: "service_id,industry_id" },
  );
  if (error) return { ok: false, error: SAVE_FAILED };
  await log("taxonomy.combo_update", "combo", `${serviceId}:${industryId}`);
  revalidatePath(`/${service.slug}/for-${industry.slug}`);
  revalidatePath("/admin/taxonomy");
  return { ok: true, data: undefined };
}

// ───────── Leads ─────────

/** SECURITY.md privacy: delete a lead on request. lead_routes cascade with it. */
export async function deleteLead(leadId: string): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const { db, log } = ctx;
  const id = uuid.safeParse(leadId);
  if (!id.success) return { ok: false, error: "Unknown lead." };
  const { error } = await db.from("leads").delete().eq("id", id.data);
  if (error) return { ok: false, error: SAVE_FAILED };
  await log("lead.delete", "lead", id.data); // ids only: the lead's details are gone on purpose
  revalidatePath("/admin/leads");
  return { ok: true, data: undefined };
}

// ───────── Notifications ─────────

/** Called when an admin opens the notifications popover: leads before now are no longer "new". */
export async function markNotificationsSeen() {
  const ctx = await adminContext();
  if (!ctx) return;
  await ctx.db
    .from("profiles")
    .update({ notifications_seen_at: new Date().toISOString() })
    .eq("id", ctx.adminId);
}

// ───────── Command palette search ─────────

export type AdminSearchResults = {
  agencies: { id: string; name: string; slug: string; website: string | null }[];
  leads: { id: string; name: string; email: string }[];
};

/** Agencies by name, website or slug; leads by email. Admin only. */
export async function adminSearch(raw: string): Promise<AdminSearchResults> {
  const ctx = await adminContext();
  if (!ctx) return { agencies: [], leads: [] };
  const { db } = ctx;
  // Only characters that can't break PostgREST's or() syntax or act as LIKE wildcards.
  const term = z
    .string()
    .max(100)
    .catch("")
    .parse(raw)
    .replace(/[^\p{L}\p{N} @.+-]/gu, " ")
    .trim();
  if (term.length < 2) return { agencies: [], leads: [] };
  const [agencies, leads] = await Promise.all([
    db
      .from("agencies")
      .select("id, name, slug, website")
      .or(`name.ilike.*${term}*,website.ilike.*${term}*,slug.ilike.*${term}*`)
      .order("name")
      .limit(6),
    db
      .from("leads")
      .select("id, name, email")
      .ilike("email", `%${term}%`)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  return { agencies: agencies.data ?? [], leads: leads.data ?? [] };
}
