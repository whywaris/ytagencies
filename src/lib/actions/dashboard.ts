"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { applyProfile } from "@/lib/agency-profile";
import { parseCalendly, parseWhatsApp } from "@/lib/booking";
import { getOwnedAgency } from "@/lib/auth";
import { removeCaseStudy, writeCaseStudy } from "@/lib/case-studies";
import { getEntitlements } from "@/lib/data/entitlements";
import { imageInfo } from "@/lib/image-info";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateAgency } from "@/lib/revalidate";
import { caseStudySchema, profileSchema } from "@/lib/validation/dashboard";
import type { FormResult } from "@/lib/validation/lead";
import { fetchChannel } from "@/lib/youtube";
import { caseStudyChannelRef, parseChannelUrl } from "@/lib/youtube-url";

// Agency dashboard mutations. Each one re-checks ownership (SECURITY.md) and writes with the
// user's own client, so RLS and the column privileges in schema.sql apply as a second guard.

const NOT_OWNER = "You don't manage this listing.";
const SAVE_FAILED = "We couldn't save that. Please try again in a minute.";
const LOGO_BUCKET = "agency-media";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const LOCKED = "Editing is locked because your Pro plan has ended. Renew Pro to edit your listing.";

/** Owner check plus the Pro lock: only managed listings can be edited (lib/entitlements.ts). */
// ponytail: the lock lives here, not in RLS; an owner calling PostgREST directly with their own
// session can still edit their own row. Add a can_manage(agency_id) check to the owner write
// policies if that ever matters.
async function editableAgency(agencyId: string) {
  const owned = await getOwnedAgency(agencyId);
  if (!owned) return { error: NOT_OWNER };
  if (!(await getEntitlements(owned.agency.id)).canEdit) return { error: LOCKED };
  return owned;
}

function invalid(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { ok: false as const, error: "Check the highlighted fields.", fieldErrors };
}

export async function updateProfile(agencyId: string, raw: unknown): Promise<FormResult> {
  const owned = await editableAgency(agencyId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const error = await applyProfile(owned.supabase, owned.agency.id, parsed.data);
  if (error) return { ok: false, error };

  revalidateAgency(owned.agency.slug);
  return { ok: true, data: undefined };
}

const bookingSchema = z.object({
  calendlyUrl: z
    .string()
    .max(300)
    .transform((v) => parseCalendly(v))
    .refine((v) => v !== null, "Use a calendly.com link, like https://calendly.com/your-agency."),
  whatsappNumber: z
    .string()
    .max(40)
    .transform((v) => parseWhatsApp(v))
    .refine((v) => v !== null, "Use a number with its country code, like +1 555 123 4567."),
});

/** Calendly link and WhatsApp number (Pro only; shown on the profile while on Pro). */
export async function updateBooking(agencyId: string, raw: unknown): Promise<FormResult> {
  const owned = await editableAgency(agencyId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await owned.supabase
    .from("agencies")
    .update({
      calendly_url: parsed.data.calendlyUrl || null,
      whatsapp_number: parsed.data.whatsappNumber || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", owned.agency.id);
  if (error) return { ok: false, error: SAVE_FAILED };
  revalidateAgency(owned.agency.slug);
  return { ok: true, data: undefined };
}

export async function uploadLogo(
  agencyId: string,
  formData: FormData,
): Promise<FormResult<{ logoPath: string }>> {
  const owned = await editableAgency(agencyId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const { supabase, agency } = owned;

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose an image to upload." };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "Use an image under 2 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageInfo(bytes); // SVG and anything else is refused (SECURITY.md: XSS risk)
  if (!kind) return { ok: false, error: "Use a PNG, JPG or WebP image." };

  // agencies/<agency id>/… is the only folder the storage policy lets this owner write to.
  const path = `agencies/${agency.id}/logo-${Date.now()}.${kind.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, bytes, { contentType: kind.type, cacheControl: "31536000", upsert: false });
  if (uploadError) return { ok: false, error: "We couldn't upload that image. Please try again." };

  const { error } = await supabase
    .from("agencies")
    .update({ logo_path: path, updated_at: new Date().toISOString() })
    .eq("id", agency.id);
  if (error) {
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
    return { ok: false, error: SAVE_FAILED };
  }
  if (agency.logo_path?.startsWith(`agencies/${agency.id}/`)) {
    await supabase.storage.from(LOGO_BUCKET).remove([agency.logo_path]);
  }

  revalidateAgency(agency.slug);
  return { ok: true, data: { logoPath: path } };
}

export async function saveCaseStudy(
  agencyId: string,
  raw: unknown,
): Promise<FormResult<{ id: string }>> {
  const owned = await editableAgency(agencyId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const parsed = caseStudySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  if (!parsed.data.id) {
    // Unlimited on Pro (Infinity); kept as a guard in case a limit comes back.
    const { caseStudies: limit } = await getEntitlements(owned.agency.id);
    const { count } = await owned.supabase
      .from("case_studies")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", owned.agency.id);
    if ((count ?? 0) >= limit) {
      return {
        ok: false,
        error: `Your plan includes up to ${limit} case studies. Edit an existing one, or upgrade for unlimited case studies.`,
      };
    }
  }
  const res = await writeCaseStudy(owned.supabase, owned.agency.id, parsed.data);
  if (!res.ok) return res;
  revalidateAgency(owned.agency.slug);
  return { ok: true, data: { id: res.id } };
}

export async function deleteCaseStudy(agencyId: string, caseStudyId: string): Promise<FormResult> {
  const owned = await editableAgency(agencyId);
  if ("error" in owned) return { ok: false, error: owned.error };
  if (!(await removeCaseStudy(owned.supabase, owned.agency.id, caseStudyId)))
    return { ok: false, error: SAVE_FAILED };
  revalidateAgency(owned.agency.slug);
  return { ok: true, data: undefined };
}

/**
 * Asks for the Verified badge (§5.4, §6). Managed (Pro) listings only.
 * Owners can't write verifications under RLS, so this inserts with the service role after the
 * ownership check. One open request per agency (unique index).
 */
export async function requestVerification(agencyId: string, urls: string[]): Promise<FormResult> {
  // Verification is part of managing a listing: Pro only, like editing.
  const owned = await editableAgency(agencyId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const list = Array.isArray(urls)
    ? urls
        .filter((u): u is string => typeof u === "string")
        .map((u) => u.trim())
        .filter(Boolean)
    : [];
  if (list.length > 10) return { ok: false, error: "Add up to 10 channels." };
  const bad = list.find((u) => u.length > 300 || !parseChannelUrl(u).ok);
  if (bad) {
    const reason = parseChannelUrl(bad.slice(0, 300));
    return { ok: false, error: `${bad.slice(0, 80)}: ${reason.ok ? "too long" : reason.error}` };
  }

  const db = createAdminClient();
  const { data: current } = await db
    .from("verifications")
    .select("status")
    .eq("agency_id", agencyId)
    .in("status", ["requested", "approved"]);
  if (current?.some((v) => v.status === "approved")) {
    return { ok: false, error: "Your agency is already verified." };
  }
  const { error } = await db.from("verifications").insert({
    agency_id: agencyId,
    status: "requested",
    channels: list.map((url) => ({ url })),
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "You already have a request in review. We'll email you when it's decided."
          : "We couldn't send your request. Please try again in a minute.",
    };
  }
  return { ok: true, data: undefined };
}

/**
 * Marks a routed lead as contacted (dashboard → Leads). The time is the database's own (a
 * trigger), set once, so response times can't be backdated. Owners can only touch their own
 * routes: ownership is checked here, and RLS + the contacted_at column grant check it again.
 */
export async function markLeadContacted(agencyId: string, leadId: string): Promise<FormResult> {
  const owned = await editableAgency(agencyId);
  if ("error" in owned) return { ok: false, error: owned.error };
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) return { ok: false, error: "Unknown lead." };
  const { error } = await owned.supabase
    .from("lead_routes")
    .update({ contacted_at: new Date().toISOString() })
    .eq("agency_id", agencyId)
    .eq("lead_id", leadId)
    .is("contacted_at", null);
  if (error) return { ok: false, error: SAVE_FAILED };
  revalidatePath(`/dashboard/${owned.agency.slug}/inquiries`);
  return { ok: true, data: undefined };
}

// ───────── Channels (agency_channels) ─────────

const channelSchema = z.object({
  url: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => caseStudyChannelRef(v) !== null,
      "Use a YouTube channel link, like https://www.youtube.com/@name.",
    ),
  industry: z.string().regex(/^[a-z0-9-]{0,80}$/),
});

/** https link, so it passes the table's check (youtube.com/@x typed without a scheme). */
const httpsChannelUrl = (raw: string) =>
  /^https:\/\//i.test(raw) ? raw : `https://${raw.replace(/^http:\/\//i, "")}`;

/**
 * Looks the channel up once (YouTube Data API, server-side) and stores its ID, title and
 * subscriber count with the service role: owners can't write these themselves (column grants).
 * Left empty when YouTube can't be reached; the monthly stats cron fills them in later.
 */
async function resolveChannel(channelRowId: string, url: string) {
  const ref = caseStudyChannelRef(url);
  if (!ref) return;
  const stats = await fetchChannel(ref);
  if (typeof stats === "string") return;
  await createAdminClient()
    .from("agency_channels")
    .update({
      channel_id: stats.channelId,
      title: stats.title,
      subscriber_count: stats.subscribers,
      stats_checked_at: new Date().toISOString(),
    })
    .eq("id", channelRowId);
}

async function industryIdFor(
  owned: NonNullable<Awaited<ReturnType<typeof getOwnedAgency>>>,
  slug: string,
) {
  if (!slug) return null;
  const { data } = await owned.supabase
    .from("industries")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

/** Adds a channel the agency worked on (max 6; the database enforces it too). */
export async function addChannel(agencyId: string, raw: unknown): Promise<FormResult> {
  const owned = await editableAgency(agencyId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const parsed = channelSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const url = httpsChannelUrl(parsed.data.url);
  const { data, error } = await owned.supabase
    .from("agency_channels")
    .insert({
      agency_id: agencyId,
      channel_url: url,
      industry_id: await industryIdFor(owned, parsed.data.industry),
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return { ok: false, error: "That channel is already on your list." };
    if (error.code === "23514") return { ok: false, error: "You can list up to 6 channels." };
    return { ok: false, error: SAVE_FAILED };
  }
  await resolveChannel(data.id, url);
  revalidatePath(`/dashboard/${owned.agency.slug}`, "layout");
  revalidateAgency(owned.agency.slug);
  return { ok: true, data: undefined };
}

/** Changes a channel's link or industry. A new link resets its confirmation (DB trigger). */
export async function updateChannel(
  agencyId: string,
  channelId: string,
  raw: unknown,
): Promise<FormResult> {
  const owned = await editableAgency(agencyId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const parsed = channelSchema.safeParse(raw);
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(channelId))
    return { ok: false, error: SAVE_FAILED };
  const url = httpsChannelUrl(parsed.data.url);
  const { data: before } = await owned.supabase
    .from("agency_channels")
    .select("channel_url")
    .eq("id", channelId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!before) return { ok: false, error: "That channel is no longer on your list." };
  const { error } = await owned.supabase
    .from("agency_channels")
    .update({ channel_url: url, industry_id: await industryIdFor(owned, parsed.data.industry) })
    .eq("id", channelId)
    .eq("agency_id", agencyId);
  if (error) return { ok: false, error: SAVE_FAILED };
  if (before.channel_url !== url) await resolveChannel(channelId, url);
  revalidatePath(`/dashboard/${owned.agency.slug}`, "layout");
  revalidateAgency(owned.agency.slug);
  return { ok: true, data: undefined };
}

export async function removeChannel(agencyId: string, channelId: string): Promise<FormResult> {
  const owned = await editableAgency(agencyId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const { error } = await owned.supabase
    .from("agency_channels")
    .delete()
    .eq("id", channelId)
    .eq("agency_id", agencyId);
  if (error) return { ok: false, error: SAVE_FAILED };
  revalidatePath(`/dashboard/${owned.agency.slug}`, "layout");
  revalidateAgency(owned.agency.slug);
  return { ok: true, data: undefined };
}
