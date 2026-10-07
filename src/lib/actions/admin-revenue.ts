"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import { getEntitlements } from "@/lib/data/entitlements";
import { revalidateDirectory } from "@/lib/revalidate";
import type { FormResult } from "@/lib/validation/lead";

// Sponsored slots (ADMIN_V2_SPEC §5.8). Admin only, service role, audit-logged. The database
// rejects overlapping slots (same page and position, or same agency on a page); this turns that
// into a readable error. Price is for records only while payments are off.

const SLUG = /^[a-z0-9-]{1,80}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const slotSchema = z
  .object({
    service: z.string().regex(SLUG, "Choose a service."),
    kind: z.enum(["hub", "industry", "location"]),
    segment: z.string().regex(/^([a-z0-9-]{1,80})?$/),
    agencyId: z.uuid("Choose an agency."),
    position: z.coerce.number().int().min(1).max(3),
    startsOn: z.string().regex(DATE, "Pick a start date."),
    endsOn: z.string().regex(DATE, "Pick an end date."),
    price: z
      .string()
      .trim()
      .regex(/^(\d{1,7}(\.\d{1,2})?)?$/, "Enter a price like 49 or 49.50, or leave it empty."),
  })
  .refine((v) => v.kind === "hub" || v.segment, { message: "Choose the page.", path: ["segment"] })
  .refine((v) => v.endsOn > v.startsOn, {
    message: "The end date must be after the start date.",
    path: ["endsOn"],
  });

export async function saveSponsoredSlot(id: string | null, raw: unknown): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (id !== null && !z.uuid().safeParse(id).success) return { ok: false, error: "Unknown slot." };
  const parsed = slotSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const [service, segment, agency] = await Promise.all([
    ctx.db.from("services").select("id, slug").eq("slug", v.service).maybeSingle(),
    v.kind === "industry"
      ? ctx.db.from("industries").select("id, slug").eq("slug", v.segment).maybeSingle()
      : v.kind === "location"
        ? ctx.db.from("locations").select("id, slug").eq("slug", v.segment).maybeSingle()
        : Promise.resolve({ data: null }),
    ctx.db.from("agencies").select("id, name, status").eq("id", v.agencyId).maybeSingle(),
  ]);
  if (!service.data || (v.kind !== "hub" && !segment.data)) {
    return { ok: false, error: "That page no longer exists." };
  }
  if (!agency.data || agency.data.status !== "published") {
    return { ok: false, error: "Only published agencies can hold a slot." };
  }
  // Your decision for §5.8: a paid plan (Founding or Verified) and the Verified badge.
  const e = await getEntitlements(v.agencyId);
  if (!e.canBuySponsored || !e.verifiedBadge) {
    return {
      ok: false,
      error: `${agency.data.name} needs a paid plan and the Verified badge to hold a slot.`,
    };
  }

  const row = {
    service_id: service.data.id,
    industry_id: v.kind === "industry" ? segment.data!.id : null,
    location_id: v.kind === "location" ? segment.data!.id : null,
    agency_id: v.agencyId,
    position: v.position,
    starts_at: `${v.startsOn}T00:00:00Z`,
    ends_at: `${v.endsOn}T00:00:00Z`,
    price_usd: v.price === "" ? null : Number(v.price),
  };
  const { data, error } = id
    ? await ctx.db.from("sponsored_slots").update(row).eq("id", id).select("id").maybeSingle()
    : await ctx.db.from("sponsored_slots").insert(row).select("id").single();
  if (error?.code === "23P01") {
    return {
      ok: false,
      error: error.message.includes("one_per_agency")
        ? `${agency.data.name} already holds a slot on this page for some of those dates.`
        : "That position is already taken on this page for some of those dates.",
    };
  }
  if (error || !data) return { ok: false, error: "We couldn't save the slot. Please try again." };

  await ctx.log(id ? "sponsored.update" : "sponsored.create", "sponsored_slot", data.id, {
    agency_id: v.agencyId,
    page: `${v.service}${v.kind === "hub" ? "" : `/${v.kind === "industry" ? "for" : "in"}-${v.segment}`}`,
    position: v.position,
  });
  revalidateDirectory();
  revalidatePath("/admin/sponsored");
  return { ok: true, data: undefined };
}

export async function deleteSponsoredSlot(id: string): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown slot." };
  const { data, error } = await ctx.db
    .from("sponsored_slots")
    .delete()
    .eq("id", id)
    .select("agency_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "We couldn't delete the slot. Please try again." };
  await ctx.log("sponsored.delete", "sponsored_slot", id, { agency_id: data.agency_id });
  revalidateDirectory();
  revalidatePath("/admin/sponsored");
  return { ok: true, data: undefined };
}
