"use server";

import type { z } from "zod";

import { applyProfile } from "@/lib/agency-profile";
import { getOwnedAgency } from "@/lib/auth";
import { removeCaseStudy, writeCaseStudy } from "@/lib/case-studies";
import { getEntitlements } from "@/lib/data/entitlements";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateAgency } from "@/lib/revalidate";
import { caseStudySchema, profileSchema } from "@/lib/validation/dashboard";
import type { FormResult } from "@/lib/validation/lead";
import { parseChannelUrl } from "@/lib/youtube-url";

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
  if (!parsed.data.id) {
    // §6: Free includes 2 case studies; paid plans are unlimited.
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
  const owned = await getOwnedAgency(agencyId);
  if (!owned) return { ok: false, error: NOT_OWNER };
  if (!(await removeCaseStudy(owned.supabase, owned.agency.id, caseStudyId)))
    return { ok: false, error: SAVE_FAILED };
  revalidateAgency(owned.agency.slug);
  return { ok: true, data: undefined };
}

/**
 * Asks for the Verified badge (§5.4, §6). Any plan can request; paid plans are reviewed first.
 * Owners can't write verifications under RLS, so this inserts with the service role after the
 * ownership check. One open request per agency (unique index).
 */
export async function requestVerification(agencyId: string, urls: string[]): Promise<FormResult> {
  const owned = await getOwnedAgency(agencyId);
  if (!owned) return { ok: false, error: NOT_OWNER };
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
