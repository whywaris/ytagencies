"use server";

import { z } from "zod";

import { adminContext } from "@/lib/admin-context";

// ───────── Command palette search ─────────

export type AdminSearchResults = {
  guides: { id: string; title: string; slug: string }[];
};

/** Guides by title. Admin only. */
export async function adminSearch(raw: string): Promise<AdminSearchResults> {
  const ctx = await adminContext();
  if (!ctx) return { guides: [] };
  const term = z.string().max(100).catch("").parse(raw).trim();
  if (term.length < 2) return { guides: [] };
  const { data } = await ctx.db
    .from("guides")
    .select("id, title, slug")
    .ilike("title", `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)
    .order("updated_at", { ascending: false })
    .limit(8);
  return { guides: data ?? [] };
}
