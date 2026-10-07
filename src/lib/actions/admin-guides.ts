"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import { imageInfo } from "@/lib/image-info";
import type { Json } from "@/lib/supabase/types";
import type { FormResult } from "@/lib/validation/lead";

// Guides CMS mutations (ADMIN_V2_SPEC §8). Admin only, service role, audit-logged.
// Slugs: auto from the title, editable until the guide has been live; after that only
// changeGuideSlug() can move it, and the old slug keeps working as a permanent redirect.

const uuid = z.uuid();
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BUCKET = "agency-media";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const SAVE_FAILED = "We couldn't save the guide. Please try again.";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");

const comboSchema = z.object({
  service_id: z.number().int().positive(),
  industry_id: z.number().int().positive().optional(),
  location_id: z.number().int().positive().optional(),
});

const guideSchema = z.object({
  title: z.string().trim().min(1, "Give the guide a title.").max(200),
  slug: z
    .string()
    .trim()
    .max(80)
    .refine((v) => v === "" || SLUG.test(v), "Use lowercase letters, numbers and single hyphens."),
  excerpt: z.string().trim().max(300, "Keep the excerpt under 300 characters."),
  body: z.string().max(100_000, "The guide is too long."),
  coverPath: z.string().max(300).nullable(),
  seoTitle: z.string().trim().max(70, "Keep the SEO title under 70 characters."),
  seoDescription: z.string().trim().max(200, "Keep the SEO description under 200 characters."),
  author: z.string().trim().max(100),
  related: z.array(comboSchema).max(10, "Pick up to 10 related pages."),
});
export type GuideInput = z.infer<typeof guideSchema>;

type Saved = { id: string; slug: string; updatedAt: string };

/** Live at some point: published (or scheduled) with a publish time that has passed. */
const hasBeenLive = (g: { published_at: string | null }) =>
  !!g.published_at && new Date(g.published_at) <= new Date();

function revalidateGuide(slug: string) {
  revalidatePath(`/guides/${slug}`);
  revalidatePath("/guides");
  revalidatePath(`/og/guide/${slug}`);
  revalidatePath("/sitemaps/guides.xml");
  revalidatePath("/admin/guides");
}

/** Creates (id = null) or saves a guide's content. Used by autosave and by the Save button. */
export async function saveGuide(id: string | null, raw: unknown): Promise<FormResult<Saved>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Unknown guide." };
  const parsed = guideSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.coverPath && !v.coverPath.startsWith("guides/"))
    return { ok: false, error: "Unknown cover." };

  const content = {
    title: v.title,
    excerpt: v.excerpt || null,
    body_md: v.body,
    cover_path: v.coverPath,
    seo_title: v.seoTitle || null,
    seo_description: v.seoDescription || null,
    author_name: v.author || null,
    related_combos: v.related as Json,
  };

  if (id === null) {
    const base = v.slug || slugify(v.title) || "guide";
    let { data, error } = await ctx.db
      .from("guides")
      .insert({ ...content, slug: base })
      .select("id, slug, updated_at")
      .single();
    if (error?.code === "23505") {
      ({ data, error } = await ctx.db
        .from("guides")
        .insert({ ...content, slug: `${base}-${randomUUID().slice(0, 6)}` })
        .select("id, slug, updated_at")
        .single());
    }
    if (error || !data) return { ok: false, error: SAVE_FAILED };
    await ctx.log("guide.create", "guide", data.id, { slug: data.slug });
    revalidatePath("/admin/guides");
    return { ok: true, data: { id: data.id, slug: data.slug, updatedAt: data.updated_at } };
  }

  const { data: current } = await ctx.db
    .from("guides")
    .select("slug, status, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "This guide was deleted." };
  const slugChange = v.slug && v.slug !== current.slug;
  if (slugChange && hasBeenLive(current)) {
    return { ok: false, error: "This guide has been live, so use Change URL to move it." };
  }
  const { data, error } = await ctx.db
    .from("guides")
    .update({ ...content, ...(slugChange ? { slug: v.slug } : {}) })
    .eq("id", id)
    .select("slug, updated_at")
    .single();
  if (error?.code === "23505") return { ok: false, error: "Another guide already uses that URL." };
  if (error || !data) return { ok: false, error: SAVE_FAILED };
  // Autosave runs every few seconds: log edits to live guides only, where they're visible.
  if (current.status !== "draft") {
    await ctx.log("guide.update", "guide", id);
    revalidateGuide(data.slug);
  }
  return { ok: true, data: { id, slug: data.slug, updatedAt: data.updated_at } };
}

const statusSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("unpublish") }),
  z.object({
    action: z.literal("schedule"),
    at: z.iso.datetime({ offset: true, error: "Pick a date and time." }),
  }),
]);

/** Publish now, schedule for later, or take a guide back to draft (its URL is kept). */
export async function setGuideStatus(
  id: string,
  raw: unknown,
): Promise<FormResult<{ status: string }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown guide." };
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { data: g } = await ctx.db
    .from("guides")
    .select("slug, title, body_md, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!g) return { ok: false, error: "This guide was deleted." };
  if (v.action !== "unpublish" && !g.body_md.trim()) {
    return { ok: false, error: "Write the guide before publishing it." };
  }

  const now = new Date();
  let update: { status: string; published_at: string | null };
  if (v.action === "publish") {
    // Keep the original date when republishing; first publish is now.
    update = {
      status: "published",
      published_at: hasBeenLive(g) ? g.published_at : now.toISOString(),
    };
  } else if (v.action === "schedule") {
    if (new Date(v.at) <= now) return { ok: false, error: "Pick a time in the future." };
    update = { status: "scheduled", published_at: new Date(v.at).toISOString() };
  } else {
    update = { status: "draft", published_at: g.published_at };
  }
  const { error } = await ctx.db.from("guides").update(update).eq("id", id);
  if (error) return { ok: false, error: SAVE_FAILED };
  await ctx.log(
    `guide.${v.action}`,
    "guide",
    id,
    v.action === "schedule" ? { at: update.published_at } : {},
  );
  revalidateGuide(g.slug);
  return { ok: true, data: { status: update.status } };
}

/** Moves a guide that has been live to a new URL; the old one redirects permanently. */
export async function changeGuideSlug(
  id: string,
  raw: string,
): Promise<FormResult<{ slug: string }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown guide." };
  const slug = typeof raw === "string" ? raw.trim() : "";
  if (!SLUG.test(slug) || slug.length > 80) {
    return { ok: false, error: "Use lowercase letters, numbers and single hyphens." };
  }
  const { data: g } = await ctx.db.from("guides").select("slug").eq("id", id).maybeSingle();
  if (!g) return { ok: false, error: "This guide was deleted." };
  if (g.slug === slug) return { ok: false, error: "That's already the URL." };
  const { data: taken } = await ctx.db.from("guides").select("id").eq("slug", slug).maybeSingle();
  if (taken) return { ok: false, error: "Another guide already uses that URL." };
  const { data: redirect } = await ctx.db
    .from("guide_redirects")
    .select("guide_id")
    .eq("from_slug", slug)
    .maybeSingle();
  if (redirect && redirect.guide_id !== id) {
    return { ok: false, error: "That URL redirects to another guide." };
  }

  // Taking back one of this guide's own old URLs: drop that redirect.
  if (redirect) await ctx.db.from("guide_redirects").delete().eq("from_slug", slug);
  const { error: redirectError } = await ctx.db
    .from("guide_redirects")
    .upsert({ from_slug: g.slug, guide_id: id }, { onConflict: "from_slug" });
  if (redirectError) return { ok: false, error: SAVE_FAILED };
  const { error } = await ctx.db.from("guides").update({ slug }).eq("id", id);
  if (error) return { ok: false, error: SAVE_FAILED };
  await ctx.log("guide.change_url", "guide", id, { from: g.slug, to: slug });
  revalidateGuide(g.slug);
  revalidateGuide(slug);
  return { ok: true, data: { slug } };
}

export async function deleteGuide(id: string): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown guide." };
  const { data, error } = await ctx.db
    .from("guides")
    .delete()
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error || !data)
    return { ok: false, error: "We couldn't delete the guide. Please try again." };
  await ctx.log("guide.delete", "guide", id, { slug: data.slug });
  revalidateGuide(data.slug);
  return { ok: true, data: undefined };
}

/**
 * Uploads a cover or inline image to guides/<guide id>/ in the public bucket. Type is checked
 * from the bytes; the size goes in the file name so pages can use next/image without guessing.
 */
export async function uploadGuideImage(
  guideId: string,
  formData: FormData,
): Promise<FormResult<{ path: string; url: string }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(guideId).success) return { ok: false, error: "Save the guide first." };
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Use an image under 2 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = imageInfo(bytes);
  if (!info) return { ok: false, error: "Use a PNG, JPG or WebP image." };

  const size = info.width && info.height ? `-${info.width}x${info.height}` : "";
  const path = `guides/${guideId}/${randomUUID().slice(0, 12)}${size}.${info.ext}`;
  const { error } = await ctx.db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: info.type, cacheControl: "31536000", upsert: false });
  if (error) return { ok: false, error: "We couldn't upload that image. Please try again." };
  await ctx.log("guide.upload_image", "guide", guideId, { path });
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  return { ok: true, data: { path, url } };
}
