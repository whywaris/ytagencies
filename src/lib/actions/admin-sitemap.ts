"use server";

import { adminContext, NOT_ADMIN } from "@/lib/admin-context";
import { revalidateSitemap } from "@/lib/revalidate";
import { sitemapEntries, SITEMAP_FILES, type SitemapFile } from "@/lib/sitemap";
import type { FormResult } from "@/lib/validation/lead";

/** Admin → Settings "Refresh sitemap": the same helper every write uses, then the URL counts. */
export async function refreshSitemap(): Promise<FormResult<Record<SitemapFile, number>>> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: NOT_ADMIN };
  revalidateSitemap();
  await ctx.log("sitemap.refresh", "system", null);
  const counts = await Promise.all(
    SITEMAP_FILES.map(async (f) => [f, (await sitemapEntries(f)).length] as const),
  );
  return { ok: true, data: Object.fromEntries(counts) as Record<SitemapFile, number> };
}
