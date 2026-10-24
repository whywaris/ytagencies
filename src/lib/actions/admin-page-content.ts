"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import { getDirectoryIndex } from "@/lib/data/agencies";
import { pageTypeOf } from "@/lib/sitemap-core";
import type { FormResult } from "@/lib/validation/lead";

// Admin → SEO pages → Write intro: the summary and intro of one directory page (page_content).
// Service × industry pages keep their own editor (Admin → Taxonomy → combo copy).

const PATH = /^\/[a-z0-9-]+(\/[a-z0-9-]+){0,3}$/;
const schema = z.object({
  summary: z.string().trim().max(300, "Use 300 characters or fewer."),
  intro: z.string().trim().max(4000, "Use 4,000 characters or fewer."),
});

export async function savePageContent(path: string, raw: unknown): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (
    typeof path !== "string" ||
    !PATH.test(path) ||
    ["service-industry", "service"].includes(pageTypeOf(path))
  )
    return { ok: false, error: "Unknown page." };
  // Only pages that exist (they have agencies), never an arbitrary path.
  if (!(await getDirectoryIndex()).paths.has(path)) return { ok: false, error: "Unknown page." };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { summary, intro } = parsed.data;

  const { error } =
    summary || intro
      ? await ctx.db
          .from("page_content")
          .upsert({ path, summary: summary || null, intro: intro || null })
      : await ctx.db.from("page_content").delete().eq("path", path);
  if (error) return { ok: false, error: "We couldn't save that. Please try again in a minute." };
  await ctx.log("seo_page.copy", "page", path);
  revalidatePath(path);
  revalidatePath("/admin/seo-pages");
  return { ok: true, data: undefined };
}
