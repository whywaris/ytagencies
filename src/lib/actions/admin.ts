"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { applyProfile } from "@/lib/agency-profile";
import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import { logoSrc } from "@/lib/logo";
import { checkLinkedImage } from "@/lib/media";
import { revalidateAgency, revalidateDirectory } from "@/lib/revalidate";
import { agencySchema, comboContentSchema, introSchema } from "@/lib/validation/admin";
import { profileSchema } from "@/lib/validation/dashboard";
import type { FormResult } from "@/lib/validation/lead";

// Admin mutations. Every action checks the admin role first (SECURITY.md), then writes with the
// service role: admin-only columns (status, flags) are blocked for normal users by column grants.
// Arguments are validated too, since bound ids from forms can be tampered with.

const SAVE_FAILED = "We couldn't save that. Please try again.";
const uuid = z.uuid();

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
    seo_title: input.seoTitle || null,
    seo_description: input.seoDescription || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data: current } = await db
      .from("agencies")
      .select("slug, status, logo_path")
      .eq("id", id)
      .maybeSingle();
    if (!current) return { ok: false, error: "Unknown agency." };
    // Logo: unchanged (an owner's upload shows as its full link) stays; "" removes it; a new link
    // must pass the checks.
    let logoPath = current.logo_path;
    if (input.logo !== (logoSrc(current.logo_path) ?? "")) {
      if (!input.logo) logoPath = null;
      else {
        const problem = await checkLinkedImage(input.logo);
        if (problem)
          return {
            ok: false,
            error: "Check the highlighted fields.",
            fieldErrors: { logo: problem },
          };
        logoPath = input.logo;
      }
    }
    if (current.status === "published" && current.slug !== input.slug) {
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: {
          slug: "Slugs can't change after publishing. Unpublish first, and add it to AGENCY_SLUG_REDIRECTS in next.config.",
        },
      };
    }
    const { error } = await db
      .from("agencies")
      .update({ ...row, logo_path: logoPath })
      .eq("id", id);
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

  if (input.logo) {
    const problem = await checkLinkedImage(input.logo);
    if (problem)
      return { ok: false, error: "Check the highlighted fields.", fieldErrors: { logo: problem } };
  }
  const { data, error } = await db
    .from("agencies")
    .insert({ ...row, logo_path: input.logo || null, status: "draft" })
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
    .select("slug, hq_location_id, hq_other")
    .eq("id", agencyId)
    .maybeSingle();
  if (!agency) return { ok: false, error: "Unknown agency." };
  const error = await applyProfile(db, agencyId, parsed.data);
  if (error) return { ok: false, error };
  // A submitted city we didn't list (hq_other) is mapped once the admin picks a new HQ.
  if (agency.hq_other) {
    const { data: after } = await db
      .from("agencies")
      .select("hq_location_id")
      .eq("id", agencyId)
      .single();
    if (after && after.hq_location_id !== agency.hq_location_id)
      await db.from("agencies").update({ hq_other: null }).eq("id", agencyId);
  }
  await log("agency.profile_update", "agency", agencyId);
  revalidateAgency(agency.slug);
  return { ok: true, data: undefined };
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
      summary: parsed.data.summary || null,
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
  guides: { id: string; title: string; slug: string }[];
};

/** Agencies by name, website or slug; leads by email. Admin only. */
export async function adminSearch(raw: string): Promise<AdminSearchResults> {
  const ctx = await adminContext();
  if (!ctx) return { agencies: [], leads: [], guides: [] };
  const { db } = ctx;
  // Only characters that can't break PostgREST's or() syntax or act as LIKE wildcards.
  const term = z
    .string()
    .max(100)
    .catch("")
    .parse(raw)
    .replace(/[^\p{L}\p{N} @.+-]/gu, " ")
    .trim();
  if (term.length < 2) return { agencies: [], leads: [], guides: [] };
  const [agencies, leads, guides] = await Promise.all([
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
    db
      .from("guides")
      .select("id, title, slug")
      .ilike("title", `%${term}%`)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);
  return { agencies: agencies.data ?? [], leads: leads.data ?? [], guides: guides.data ?? [] };
}
