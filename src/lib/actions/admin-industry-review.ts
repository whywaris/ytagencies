"use server";

import { revalidatePath } from "next/cache";

import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import { revalidateAgency } from "@/lib/revalidate";

// Admin → Directory → Industry review. Approving writes the tag (agency_industries,
// is_primary = false) and refreshes every page it can change: the profile, the industry hub, the
// service × industry pages and the sitemaps (revalidateAgency). Rejecting only records the
// decision, so the script never suggests that pair again.

type Result = { ok: true; done: number } | { ok: false; error: string };
const UUID = /^[0-9a-f-]{36}$/i;

type Ctx = NonNullable<Awaited<ReturnType<typeof adminContext>>>;

/** Callers check the admin first (adminContext) and pass the context in. */
async function decide(ctx: Ctx, ids: string[], decision: "approved" | "rejected"): Promise<Result> {
  if (!ids.length || ids.some((id) => !UUID.test(id))) return { ok: false, error: "Unknown suggestion." };
  const { db, adminId, log } = ctx;

  const { data: rows, error } = await db
    .from("industry_suggestions")
    .select("id, agency_id, industry_id, agencies(slug, is_claimed)")
    .in("id", ids)
    .eq("status", "pending");
  if (error) return { ok: false, error: "We couldn't load those suggestions." };
  if (!rows.length) return { ok: false, error: "Already reviewed." };

  // A listing claimed since the suggestion was made: its owner's choices win.
  const open = decision === "approved" ? rows.filter((r) => !r.agencies?.is_claimed) : rows;
  if (!open.length) return { ok: false, error: "That agency has been claimed: its owner picks its industries." };

  if (decision === "approved") {
    const { error: tagError } = await db.from("agency_industries").upsert(
      open.map((r) => ({ agency_id: r.agency_id, industry_id: r.industry_id, is_primary: false })),
      { onConflict: "agency_id,industry_id", ignoreDuplicates: true },
    );
    if (tagError) return { ok: false, error: "We couldn't add the industry. Please try again." };
  }
  const { error: updateError } = await db
    .from("industry_suggestions")
    .update({ status: decision, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .in("id", open.map((r) => r.id))
    .eq("status", "pending");
  if (updateError) return { ok: false, error: "We couldn't save that. Please try again." };

  for (const r of open)
    await log(`industry_suggestion.${decision === "approved" ? "approve" : "reject"}`, "agency", r.agency_id, {
      suggestion: r.id,
      industry: r.industry_id,
    });
  if (decision === "approved")
    for (const slug of new Set(open.map((r) => r.agencies?.slug).filter((s): s is string => !!s)))
      revalidateAgency(slug);
  revalidatePath("/admin/industry-review");
  return { ok: true, done: open.length };
}

export async function reviewSuggestion(id: string, decision: "approved" | "rejected"): Promise<Result> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  return decide(ctx, [id], decision === "approved" ? "approved" : "rejected");
}

/** "Approve all ≥ 0.8" for one agency. */
export async function approveConfident(agencyId: string): Promise<Result> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!UUID.test(agencyId)) return { ok: false, error: "Unknown agency." };
  const { data, error } = await ctx.db
    .from("industry_suggestions")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("status", "pending")
    .gte("confidence", 0.8);
  if (error) return { ok: false, error: "We couldn't load those suggestions." };
  if (!data.length) return { ok: false, error: "Nothing at 0.8 or above." };
  return decide(ctx, data.map((r) => r.id), "approved");
}
