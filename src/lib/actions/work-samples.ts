"use server";

import { z } from "zod";

import { getOwnedAgency } from "@/lib/auth";
import { getEntitlements } from "@/lib/data/entitlements";
import { revalidateAgency } from "@/lib/revalidate";
import type { FormResult } from "@/lib/validation/lead";
import {
  canAddSample,
  NOTE_MAX,
  oembedUrl,
  parseVideoUrl,
  readOEmbed,
} from "@/lib/work-samples";

// Dashboard → Work samples. Each action re-checks ownership and writes with the owner's own client,
// so RLS and the column grants (schema.sql: never hidden_at) apply too.

const NOT_OWNER = "You don't manage this listing.";
const SAVE_FAILED = "We couldn't save that. Please try again in a minute.";
const uuid = z.uuid();

const addSchema = z.object({
  url: z.string().trim().max(500, "That link is too long."),
  service: z.string().regex(/^[a-z0-9-]{1,80}$/, "Choose a service."),
  note: z.string().trim().max(NOTE_MAX, `Use ${NOTE_MAX} characters or fewer.`),
  workedOnIt: z.boolean().refine((v) => v, "Confirm you worked on this video."),
});
export type WorkSampleInput = z.infer<typeof addSchema>;

const fail = (field: string, message: string): FormResult => ({
  ok: false,
  error: "Check the highlighted fields.",
  fieldErrors: { [field]: message },
});

export async function addWorkSample(agencyId: string, raw: unknown): Promise<FormResult> {
  const owned = await getOwnedAgency(agencyId);
  if (!owned) return { ok: false, error: NOT_OWNER };
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(String(issue.path[0]), issue.message);
  }
  const v = parsed.data;
  const video = parseVideoUrl(v.url);
  if (!video.ok) return fail("url", video.error);

  const { supabase, agency } = owned;
  const [{ workSamples: limit }, saved, service] = await Promise.all([
    getEntitlements(agency.id),
    supabase.from("work_samples").select("sort_order").eq("agency_id", agency.id),
    // Only one of the agency's own services.
    supabase
      .from("agency_services")
      .select("service_id, services!inner(slug)")
      .eq("agency_id", agency.id)
      .eq("services.slug", v.service)
      .maybeSingle(),
  ]);
  if (saved.error) return { ok: false, error: SAVE_FAILED };
  if (!canAddSample(saved.data.length, limit))
    return {
      ok: false,
      error: `Your plan includes up to ${limit} work samples. Remove one, or upgrade to Pro for up to 12.`,
    };
  if (!service.data) return fail("service", "Choose one of the services on your profile.");

  let check;
  try {
    const res = await fetch(oembedUrl(video.id), {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    check = readOEmbed(res.status, res.ok ? await res.json() : null, video.short);
  } catch {
    check = readOEmbed(0, null, video.short);
  }
  if (!check.ok) return fail("url", check.error);

  const { error } = await supabase.from("work_samples").insert({
    agency_id: agency.id,
    youtube_video_id: video.id,
    title: check.title,
    format: check.format,
    service_id: service.data.service_id,
    note: v.note || null,
    sort_order: Math.max(-1, ...saved.data.map((s) => s.sort_order)) + 1,
  });
  if (error)
    return error.code === "23505"
      ? fail("url", "You've already added this video.")
      : { ok: false, error: SAVE_FAILED };
  revalidateAgency(agency.slug);
  return { ok: true, data: undefined };
}

/** Moves a sample one place up or down; rewrites the order 0..n so it stays tidy. */
export async function moveWorkSample(
  agencyId: string,
  id: string,
  direction: "up" | "down",
): Promise<FormResult> {
  const owned = await getOwnedAgency(agencyId);
  if (!owned) return { ok: false, error: NOT_OWNER };
  if (!uuid.safeParse(id).success || (direction !== "up" && direction !== "down"))
    return { ok: false, error: SAVE_FAILED };
  const { supabase, agency } = owned;
  const { data, error } = await supabase
    .from("work_samples")
    .select("id, sort_order")
    .eq("agency_id", agency.id)
    .order("sort_order")
    .order("created_at");
  if (error) return { ok: false, error: SAVE_FAILED };
  const i = data.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= data.length) return { ok: true, data: undefined };
  const order = [...data];
  [order[i], order[j]] = [order[j], order[i]];
  const results = await Promise.all(
    order.map((s, n) =>
      s.sort_order === n
        ? null
        : supabase.from("work_samples").update({ sort_order: n }).eq("id", s.id),
    ),
  );
  if (results.some((r) => r?.error)) return { ok: false, error: SAVE_FAILED };
  revalidateAgency(agency.slug);
  return { ok: true, data: undefined };
}

export async function deleteWorkSample(agencyId: string, id: string): Promise<FormResult> {
  const owned = await getOwnedAgency(agencyId);
  if (!owned) return { ok: false, error: NOT_OWNER };
  if (!uuid.safeParse(id).success) return { ok: false, error: SAVE_FAILED };
  const { error } = await owned.supabase
    .from("work_samples")
    .delete()
    .eq("id", id)
    .eq("agency_id", owned.agency.id);
  if (error) return { ok: false, error: SAVE_FAILED };
  revalidateAgency(owned.agency.slug);
  return { ok: true, data: undefined };
}
