"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import { imageInfo } from "@/lib/image-info";
import type { FormResult } from "@/lib/validation/lead";
import { revalidateSitemap } from "@/lib/revalidate";

// Guide authors (admin only, service role, audit-logged). Photos follow the same upload rules
// as guide images: PNG/JPG/WebP checked from the bytes, max 2 MB, public bucket.

const uuid = z.uuid();
const BUCKET = "agency-media";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const SAVE_FAILED = "We couldn't save the author. Please try again.";

const httpsUrl = z
  .string()
  .trim()
  .max(300, "Keep links under 300 characters.")
  .refine((v) => v === "" || /^https:\/\/[^\s]+\.[^\s]+$/.test(v), "Use a full https:// link.");

const authorSchema = z.object({
  name: z.string().trim().min(1, "Add the author's name.").max(100),
  slug: z
    .string()
    .trim()
    .min(1, "Add a URL slug.")
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens."),
  role: z.string().trim().max(100),
  bio: z.string().trim().max(300, "Keep the bio under 300 characters."),
  linkedinUrl: httpsUrl,
  xUrl: httpsUrl,
  websiteUrl: httpsUrl,
});
export type AuthorInput = z.infer<typeof authorSchema>;

/** Pages that show an author: their page, every guide (byline, author box) and the sitemap. */
function revalidateAuthor(...slugs: string[]) {
  for (const slug of slugs) revalidatePath(`/authors/${slug}`);
  revalidatePath("/guides/[slug]", "page");
  revalidatePath("/guides");
  revalidateSitemap("authors");
  revalidatePath("/admin/authors");
}

function invalid(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { ok: false as const, error: "Check the highlighted fields.", fieldErrors };
}

/** Creates (id = null) or updates an author. Returns the author's id. */
export async function saveAuthor(
  id: string | null,
  raw: unknown,
): Promise<FormResult<{ id: string }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Unknown author." };
  const parsed = authorSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const row = {
    name: v.name,
    slug: v.slug,
    role: v.role || null,
    bio: v.bio || null,
    linkedin_url: v.linkedinUrl || null,
    x_url: v.xUrl || null,
    website_url: v.websiteUrl || null,
  };
  const taken = {
    ok: false as const,
    error: "Check the highlighted fields.",
    fieldErrors: { slug: "Another author already uses this URL." },
  };

  if (id === null) {
    const { data, error } = await ctx.db.from("authors").insert(row).select("id").single();
    if (error?.code === "23505") return taken;
    if (error || !data) return { ok: false, error: SAVE_FAILED };
    await ctx.log("author.create", "author", data.id, { slug: v.slug });
    revalidatePath("/admin/authors");
    return { ok: true, data: { id: data.id } };
  }

  const { data: before } = await ctx.db.from("authors").select("slug").eq("id", id).maybeSingle();
  if (!before) return { ok: false, error: "This author was deleted." };
  const { error } = await ctx.db.from("authors").update(row).eq("id", id);
  if (error?.code === "23505") return taken;
  if (error) return { ok: false, error: SAVE_FAILED };
  await ctx.log("author.update", "author", id, {
    fields: Object.keys(row),
    ...(before.slug !== v.slug ? { slug_from: before.slug, slug_to: v.slug } : {}),
  });
  revalidateAuthor(before.slug, v.slug);
  return { ok: true, data: { id } };
}

/** Uploads a photo to authors/<id>/ and sets it. The old file stays (cached copies may use it). */
export async function uploadAuthorPhoto(
  id: string,
  formData: FormData,
): Promise<FormResult<{ path: string }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Save the author first." };
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Use an image under 2 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = imageInfo(bytes);
  if (!info) return { ok: false, error: "Use a PNG, JPG or WebP image." };

  const size = info.width && info.height ? `-${info.width}x${info.height}` : "";
  const path = `authors/${id}/${randomUUID().slice(0, 12)}${size}.${info.ext}`;
  const { error: uploadError } = await ctx.db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: info.type, cacheControl: "31536000", upsert: false });
  if (uploadError) return { ok: false, error: "We couldn't upload that image. Please try again." };
  const { data, error } = await ctx.db
    .from("authors")
    .update({ avatar_path: path })
    .eq("id", id)
    .select("slug")
    .single();
  if (error || !data) return { ok: false, error: SAVE_FAILED };
  await ctx.log("author.photo", "author", id, { path });
  revalidateAuthor(data.slug);
  return { ok: true, data: { path } };
}

export async function removeAuthorPhoto(id: string): Promise<FormResult> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown author." };
  const { data, error } = await ctx.db
    .from("authors")
    .update({ avatar_path: null })
    .eq("id", id)
    .select("slug")
    .single();
  if (error || !data) return { ok: false, error: SAVE_FAILED };
  await ctx.log("author.photo_remove", "author", id);
  revalidateAuthor(data.slug);
  return { ok: true, data: undefined };
}
