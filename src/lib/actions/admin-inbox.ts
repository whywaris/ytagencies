"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import type { FormResult } from "@/lib/validation/lead";

// Admin → Inbox (/contact messages). Admin only, service role, audit-logged with ids only.

const uuid = z.uuid();

export async function setMessageStatus(id: string, status: "open" | "closed"): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(id).success || !["open", "closed"].includes(status)) {
    return { ok: false, error: "Unknown message." };
  }
  const { error } = await ctx.db
    .from("contact_messages")
    .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: "We couldn't update the message. Please try again." };
  await ctx.log(status === "closed" ? "message.close" : "message.reopen", "contact_message", id);
  revalidatePath("/admin/inbox");
  return { ok: true, data: undefined };
}

/** Permanent, e.g. for a privacy request to delete the sender's data. */
export async function deleteMessage(id: string): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown message." };
  const { error } = await ctx.db.from("contact_messages").delete().eq("id", id);
  if (error) return { ok: false, error: "We couldn't delete the message. Please try again." };
  await ctx.log("message.delete", "contact_message", id);
  revalidatePath("/admin/inbox");
  return { ok: true, data: undefined };
}
