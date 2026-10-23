"use server";

import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import {
  docText,
  docToHtml,
  guideDoc,
  imagesWithoutAlt,
  sanitizeDoc,
  type Doc,
} from "@/lib/guide-content";
import { GUIDE_MEDIA_BUCKET, guideImageAllowed, guideMediaUrl } from "@/lib/guide-media";
import { imageInfo } from "@/lib/image-info";
import { isPublicIp } from "@/lib/net-guard";
import { checkLinkedImage, imageLinkError } from "@/lib/media";
import type { Json } from "@/lib/supabase/types";
import type { FormResult } from "@/lib/validation/lead";
import { revalidateSitemap } from "@/lib/revalidate";

// Guides CMS mutations (ADMIN_V2_SPEC §8). Admin only, service role, audit-logged.
// Slugs: auto from the title, editable until the guide has been live; after that only
// changeGuideSlug() can move it, and the old slug keeps working as a permanent redirect.

const uuid = z.uuid();
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_HTML = 400_000;
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
  // Tiptap JSON. Sanitized on the server (lib/guide-content.ts) before anything is stored.
  body: z.unknown(),
  // An upload in guide-media, a link to our Cloudflare image host (lib/media.ts), or an older
  // upload in agency-media.
  coverPath: z.string().trim().max(500).nullable(),
  seoTitle: z.string().trim().max(70, "Keep the SEO title under 70 characters."),
  seoDescription: z.string().trim().max(200, "Keep the SEO description under 200 characters."),
  authorId: uuid.nullable(),
  related: z.array(comboSchema).max(10, "Pick up to 10 related pages."),
  // One per line in the editor; blank lines are dropped.
  keyTakeaways: z
    .array(z.string().trim().max(200, "Keep each takeaway under 200 characters."))
    .transform((lines) => lines.filter(Boolean))
    .pipe(z.array(z.string()).max(5, "Add up to 5 key takeaways.")),
  numberedSections: z.boolean(),
});
export type GuideInput = z.infer<typeof guideSchema>;

/** draft: the guide is live and this save went to its unpublished changes. */
type Saved = { id: string; slug: string; updatedAt: string; draft: boolean };

/** Live at some point: published (or scheduled) with a publish time that has passed. */
const hasBeenLive = (g: { published_at: string | null }) =>
  !!g.published_at && new Date(g.published_at) <= new Date();
/** On the site right now. */
const isLive = (g: { status: string; published_at: string | null }) =>
  g.status !== "draft" && hasBeenLive(g);

const NO_DRAFT = { draft_json: null, draft_html: null, draft_meta: null, draft_updated_at: null };

function revalidateGuide(slug: string) {
  revalidatePath(`/guides/${slug}`);
  revalidatePath("/guides");
  revalidatePath(`/og/guide/${slug}`);
  revalidatePath(`/og/guide/${slug}/cover`);
  revalidatePath(`/og/guide/${slug}/cover/dark`);
  revalidateSitemap("guides", "authors", "pages");
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
  if (v.coverPath && !v.coverPath.startsWith("guides/") && !guideImageAllowed(v.coverPath)) {
    const coverError = imageLinkError(v.coverPath);
    if (coverError) return { ok: false, error: `Cover image: ${coverError}` };
  }
  const doc = sanitizeDoc(v.body, guideImageAllowed);
  const html = docToHtml(doc, guideImageAllowed);
  if (html.length > MAX_HTML) return { ok: false, error: "The guide is too long." };

  const content = {
    title: v.title,
    excerpt: v.excerpt || null,
    body_json: doc as unknown as Json,
    body_html: html,
    cover_path: v.coverPath,
    seo_title: v.seoTitle || null,
    seo_description: v.seoDescription || null,
    author_id: v.authorId,
    related_combos: v.related as Json,
    key_takeaways: v.keyTakeaways,
    numbered_sections: v.numberedSections,
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
    return {
      ok: true,
      data: { id: data.id, slug: data.slug, updatedAt: data.updated_at, draft: false },
    };
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

  // Live guide: edits are unpublished changes (admin-only columns); the page changes on "Update".
  if (isLive(current)) {
    const { body_json, body_html, ...meta } = content;
    const { data, error } = await ctx.db
      .from("guides")
      .update({
        draft_json: body_json,
        draft_html: body_html,
        draft_meta: meta as Json,
        draft_updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("slug, updated_at")
      .single();
    if (error || !data) return { ok: false, error: SAVE_FAILED };
    return { ok: true, data: { id, slug: data.slug, updatedAt: data.updated_at, draft: true } };
  }

  // Not live: save straight to the guide (a draft left from when it was live is folded in).
  const { data, error } = await ctx.db
    .from("guides")
    .update({ ...content, ...NO_DRAFT, ...(slugChange ? { slug: v.slug } : {}) })
    .eq("id", id)
    .select("slug, updated_at")
    .single();
  if (error?.code === "23505") return { ok: false, error: "Another guide already uses that URL." };
  if (error || !data) return { ok: false, error: SAVE_FAILED };
  // A scheduled guide's page (once its time comes) is cached: refresh it.
  if (current.status === "scheduled") revalidateGuide(data.slug);
  return { ok: true, data: { id, slug: data.slug, updatedAt: data.updated_at, draft: false } };
}

/** Throws away a live guide's unpublished changes. */
export async function discardGuideDraft(id: string): Promise<FormResult<null>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown guide." };
  const { error } = await ctx.db.from("guides").update(NO_DRAFT).eq("id", id);
  if (error) return { ok: false, error: SAVE_FAILED };
  await ctx.log("guide.discard_draft", "guide", id);
  revalidatePath("/admin/guides");
  return { ok: true, data: null };
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
    .select("slug, title, body_md, body_json, published_at, draft_json, draft_html, draft_meta")
    .eq("id", id)
    .maybeSingle();
  if (!g) return { ok: false, error: "This guide was deleted." };
  const hasDraft = !!g.draft_json;
  if (v.action !== "unpublish") {
    // What goes live: the unpublished changes if there are any.
    const doc = guideDoc(g.draft_json ?? g.body_json, g.body_md);
    if (!docText(doc)) return { ok: false, error: "Write the guide before publishing it." };
    const noAlt = imagesWithoutAlt(doc);
    if (noAlt)
      return {
        ok: false,
        error: `Add alt text to ${noAlt === 1 ? "1 image" : `${noAlt} images`} before publishing (click the image, then Alt text).`,
      };
  }

  const now = new Date();
  let update: { status: string; published_at: string | null };
  let contentUpdated: string | null = null;
  // Publishing or scheduling applies the unpublished changes; unpublishing keeps them.
  const apply =
    v.action !== "unpublish" && hasDraft
      ? {
          ...(g.draft_meta as Record<string, unknown>),
          body_json: g.draft_json,
          body_html: g.draft_html,
          ...NO_DRAFT,
        }
      : {};
  if (v.action === "publish") {
    // Keep the original date when republishing; first publish is now.
    update = {
      status: "published",
      published_at: hasBeenLive(g) ? g.published_at : now.toISOString(),
    };
    // "Updated" on the page: the first publish, then each update that changed something.
    if (!hasBeenLive(g) || hasDraft) contentUpdated = now.toISOString();
  } else if (v.action === "schedule") {
    if (new Date(v.at) <= now) return { ok: false, error: "Pick a time in the future." };
    update = { status: "scheduled", published_at: new Date(v.at).toISOString() };
  } else {
    update = { status: "draft", published_at: g.published_at };
  }
  const { error } = await ctx.db
    .from("guides")
    .update({
      ...apply,
      ...update,
      ...(contentUpdated ? { content_updated_at: contentUpdated } : {}),
    })
    .eq("id", id);
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

/** Stores image bytes in guide-media under <guide id>/, with the size in the file name. */
async function storeGuideImage(
  ctx: NonNullable<Awaited<ReturnType<typeof adminContext>>>,
  guideId: string,
  bytes: Uint8Array,
): Promise<FormResult<{ url: string }>> {
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: "Use an image under 5 MB." };
  const info = imageInfo(bytes, { gif: true });
  if (!info) return { ok: false, error: "Use a JPG, PNG, WebP or GIF image." };
  const size = info.width && info.height ? `-${info.width}x${info.height}` : "";
  const path = `${guideId}/${randomUUID().slice(0, 12)}${size}.${info.ext}`;
  const { error } = await ctx.db.storage
    .from(GUIDE_MEDIA_BUCKET)
    .upload(path, bytes, { contentType: info.type, cacheControl: "31536000", upsert: false });
  if (error) return { ok: false, error: "We couldn't upload that image. Please try again." };
  await ctx.log("guide.upload_image", "guide", guideId, { path });
  return { ok: true, data: { url: guideMediaUrl(path) } };
}

/**
 * Uploads an image (toolbar, drag & drop, paste, cover) to guide-media. The type is checked from
 * the bytes, never the declared type; the size goes in the file name for next/image.
 */
export async function uploadGuideImage(
  guideId: string,
  formData: FormData,
): Promise<FormResult<{ url: string }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(guideId).success) return { ok: false, error: "Save the guide first." };
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Use an image under 5 MB." };
  return storeGuideImage(ctx, guideId, new Uint8Array(await file.arrayBuffer()));
}

/**
 * A remote image from pasted content, copied into guide-media. Only https, only public addresses
 * (checked for every redirect hop: no requests into private networks), an image content type and
 * at most 5 MB. Any failure: the editor drops the image and says so.
 */
// ponytail: the address is checked at lookup time; a DNS answer that changes between the check
// and the fetch (rebinding) isn't covered. Pin the resolved IP with a custom agent if that matters.
export async function importRemoteImage(
  guideId: string,
  url: string,
): Promise<FormResult<{ url: string }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  if (!uuid.safeParse(guideId).success) return { ok: false, error: "Save the guide first." };
  const failed = { ok: false as const, error: "That image couldn't be copied." };
  let target = url;
  for (let hop = 0; hop < 4; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return failed;
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return failed;
    if (parsed.port && parsed.port !== "443") return failed;
    const addresses = await lookup(parsed.hostname, { all: true }).catch(() => []);
    if (!addresses.length || !addresses.every((a) => isPublicIp(a.address))) return failed;

    const res = await fetch(parsed, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "image/*" },
    }).catch(() => null);
    if (!res) return failed;
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return failed;
      target = new URL(next, parsed).href;
      continue;
    }
    if (!res.ok || !/^image\//.test(res.headers.get("content-type") ?? "")) return failed;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) return failed;
    // Read with a cap, whatever the server claims.
    const reader = res.body?.getReader();
    if (!reader) return failed;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return failed;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    return storeGuideImage(ctx, guideId, bytes);
  }
  return failed;
}

/** The document type the editor sends, for client imports. */
export type GuideDoc = Doc;

/** A cover link pasted in the editor: the full check (host, file type, HEAD: image, ≤ 1 MB). */
export async function checkCoverLink(url: string): Promise<FormResult<{ url: string }>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  const link = typeof url === "string" ? url.trim() : "";
  const problem = await checkLinkedImage(link);
  return problem ? { ok: false, error: problem } : { ok: true, data: { url: link } };
}
