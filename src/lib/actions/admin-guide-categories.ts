"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import { canDeleteCategory, categorySlug, COLOR_KEYS } from "@/lib/guide-categories";
import { revalidateSitemap } from "@/lib/revalidate";
import type { FormResult } from "@/lib/validation/lead";

// Admin → Guides → Categories, and the /guides tab limit (Admin → Settings). Every change
// refreshes /guides, the category pages and the guides sitemap.

const uuid = z.uuid();
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const schema = z.object({
  name: z.string().trim().min(1, "Name the category.").max(60, "Use 60 characters or fewer."),
  // Empty: from the name.
  slug: z
    .string()
    .trim()
    .max(60, "Use 60 characters or fewer.")
    .refine((v) => v === "" || SLUG.test(v), "Use lowercase letters, numbers and single hyphens."),
  description: z.string().trim().max(300, "Use 300 characters or fewer."),
  color: z.enum(COLOR_KEYS as [string, ...string[]]),
  showInTabs: z.boolean(),
});
export type CategoryInput = z.infer<typeof schema>;

function refresh(slugs: string[]) {
  revalidatePath("/guides");
  for (const s of slugs) revalidatePath(`/guides/category/${s}`);
  revalidatePath("/(marketing)/guides/[slug]", "page");
  revalidatePath("/admin/guides/categories");
  revalidateSitemap("guides");
}

/** Creates (id = null) or updates a category. A changed slug keeps the old URL as a redirect. */
export async function saveCategory(id: string | null, raw: unknown): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Unknown category." };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: { [String(issue.path[0])]: issue.message } };
  }
  const v = parsed.data;
  const slug = v.slug || categorySlug(v.name);
  if (!slug) return { ok: false, error: "Check the highlighted fields.", fieldErrors: { slug: "Add a slug." } };
  const row = {
    name: v.name,
    slug,
    description: v.description || null,
    color: v.color,
    show_in_tabs: v.showInTabs,
  };

  if (id === null) {
    const { data: last } = await ctx.db
      .from("guide_categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await ctx.db
      .from("guide_categories")
      .insert({ ...row, sort_order: (last?.sort_order ?? -1) + 1 })
      .select("id")
      .single();
    if (error) return slugTaken(error.code) ?? { ok: false, error: "We couldn't save that." };
    await ctx.log("guide_category.create", "guide_category", data.id, { slug });
    refresh([slug]);
    return { ok: true, data: undefined };
  }

  const { data: before } = await ctx.db
    .from("guide_categories")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false, error: "This category was deleted." };
  const { error } = await ctx.db.from("guide_categories").update(row).eq("id", id);
  if (error) return slugTaken(error.code) ?? { ok: false, error: "We couldn't save that." };
  if (before.slug !== slug) {
    // The old URL redirects here for good; the new slug can't also be a redirect.
    await ctx.db.from("guide_category_redirects").delete().eq("from_slug", slug);
    await ctx.db
      .from("guide_category_redirects")
      .upsert({ from_slug: before.slug, category_id: id });
  }
  await ctx.log("guide_category.update", "guide_category", id, {
    ...(before.slug !== slug ? { slug: { from: before.slug, to: slug } } : {}),
  });
  refresh([before.slug, slug]);
  return { ok: true, data: undefined };
}

const slugTaken = (code?: string) =>
  code === "23505"
    ? {
        ok: false as const,
        error: "Check the highlighted fields.",
        fieldErrors: { slug: "Another category already uses this slug." },
      }
    : null;

/** Deletes a category nobody uses; with guides in it, asks to move them first. */
export async function deleteCategory(id: string): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown category." };
  const { count, error: countError } = await ctx.db
    .from("guides")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if (countError) return { ok: false, error: "We couldn't check that. Please try again." };
  if (!canDeleteCategory(count ?? 0))
    return {
      ok: false,
      error: `${count} ${count === 1 ? "guide uses" : "guides use"} this category. Move ${count === 1 ? "it" : "them"} to another category first.`,
    };
  const { data, error } = await ctx.db
    .from("guide_categories")
    .delete()
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "We couldn't delete that." };
  await ctx.log("guide_category.delete", "guide_category", id, { slug: data.slug });
  refresh([data.slug]);
  return { ok: true, data: undefined };
}

/** Moves a category one place up or down (the tab order on /guides). */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(id).success || (direction !== "up" && direction !== "down"))
    return { ok: false, error: "Unknown category." };
  const { data, error } = await ctx.db
    .from("guide_categories")
    .select("id, slug, sort_order, name")
    .order("sort_order")
    .order("name");
  if (error) return { ok: false, error: "We couldn't move that." };
  const i = data.findIndex((c) => c.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= data.length) return { ok: true, data: undefined };
  const order = [...data];
  [order[i], order[j]] = [order[j], order[i]];
  // Rewrite 0..n so ties from older rows can't keep two in the same place.
  const results = await Promise.all(
    order.map((c, n) =>
      c.sort_order === n
        ? null
        : ctx.db.from("guide_categories").update({ sort_order: n }).eq("id", c.id),
    ),
  );
  if (results.some((r) => r?.error)) return { ok: false, error: "We couldn't move that." };
  refresh([]);
  return { ok: true, data: undefined };
}

/** Admin → Settings: how many category tabs /guides shows before "More". */
export async function saveGuideTabsMax(raw: unknown): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const n = z.coerce.number().int().min(1).max(12).safeParse(raw);
  if (!n.success) return { ok: false, error: "Use a number from 1 to 12." };
  const { error } = await ctx.db.from("app_settings").update({ guide_tabs_max: n.data }).eq("id", true);
  if (error) return { ok: false, error: "We couldn't save that." };
  await ctx.log("settings.guide_tabs_max", "system", null, { value: n.data });
  revalidatePath("/guides");
  revalidatePath("/(marketing)/guides/category/[slug]", "page");
  revalidatePath("/admin/settings");
  return { ok: true, data: undefined };
}
