"use server";

import type { z } from "zod";

import { applyProfile } from "@/lib/agency-profile";
import { getOwnedAgency } from "@/lib/auth";
import { revalidateAgency } from "@/lib/revalidate";
import { caseStudySchema, metricsToJson, profileSchema } from "@/lib/validation/dashboard";
import type { FormResult } from "@/lib/validation/lead";

// Agency dashboard mutations. Each one re-checks ownership (SECURITY.md) and writes with the
// user's own client, so RLS and the column privileges in schema.sql apply as a second guard.

const NOT_OWNER = "You don't manage this listing.";
const SAVE_FAILED = "We couldn't save that. Please try again in a minute.";
const LOGO_BUCKET = "agency-media";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function invalid(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { ok: false as const, error: "Check the highlighted fields.", fieldErrors };
}

export async function updateProfile(agencyId: string, raw: unknown): Promise<FormResult> {
  const owned = await getOwnedAgency(agencyId);
  if (!owned) return { ok: false, error: NOT_OWNER };
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const error = await applyProfile(owned.supabase, owned.agency.id, parsed.data);
  if (error) return { ok: false, error };

  revalidateAgency(owned.agency.slug);
  return { ok: true, data: undefined };
}

/** Real file type from the first bytes. The declared type and extension can't be trusted. */
function sniffImage(bytes: Uint8Array): { type: string; ext: string } | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { type: "image/png", ext: "png" };
  if (starts([0xff, 0xd8, 0xff])) return { type: "image/jpeg", ext: "jpg" };
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))
    return { type: "image/webp", ext: "webp" };
  return null; // includes SVG, which SECURITY.md forbids (XSS risk)
}

export async function uploadLogo(
  agencyId: string,
  formData: FormData,
): Promise<FormResult<{ logoPath: string }>> {
  const owned = await getOwnedAgency(agencyId);
  if (!owned) return { ok: false, error: NOT_OWNER };
  const { supabase, agency } = owned;

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose an image to upload." };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "Use an image under 2 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
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
  const owned = await getOwnedAgency(agencyId);
  if (!owned) return { ok: false, error: NOT_OWNER };
  const parsed = caseStudySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const { supabase, agency } = owned;

  let industryId: number | null = null;
  if (input.industry) {
    const { data } = await supabase
      .from("industries")
      .select("id")
      .eq("slug", input.industry)
      .maybeSingle();
    if (!data) return { ok: false, error: "That industry no longer exists. Reload the page." };
    industryId = data.id;
  }
  const row = {
    title: input.title,
    client_industry_id: industryId,
    channel_url: input.channelUrl || null,
    summary: input.summary || null,
    metrics: metricsToJson(input.metrics),
  };

  // Updates are scoped to this agency, so an id from another agency matches nothing.
  const { data, error } = input.id
    ? await supabase
        .from("case_studies")
        .update(row)
        .eq("id", input.id)
        .eq("agency_id", agency.id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("case_studies")
        .insert({ ...row, agency_id: agency.id })
        .select("id")
        .single();
  if (error || !data) return { ok: false, error: SAVE_FAILED };

  revalidateAgency(agency.slug);
  return { ok: true, data: { id: data.id } };
}

export async function deleteCaseStudy(agencyId: string, caseStudyId: string): Promise<FormResult> {
  const owned = await getOwnedAgency(agencyId);
  if (!owned) return { ok: false, error: NOT_OWNER };
  const { supabase, agency } = owned;
  const { error } = await supabase
    .from("case_studies")
    .delete()
    .eq("id", caseStudyId)
    .eq("agency_id", agency.id);
  if (error) return { ok: false, error: SAVE_FAILED };
  revalidateAgency(agency.slug);
  return { ok: true, data: undefined };
}
