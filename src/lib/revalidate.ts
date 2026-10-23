import "server-only";
import { revalidatePath } from "next/cache";

import { SITEMAP_FILES, type SitemapFile } from "@/lib/sitemap-core";

/** The profile page and every directory page it can appear on (ISR, docs/SEO.md). */
export function revalidateAgency(slug: string) {
  revalidatePath(`/agency/${slug}`);
  revalidatePath(`/og/agency/${slug}`);
  // Publishing, unpublishing or fixing a thin profile changes the profile list, the directory
  // pages' counts (a combo can reach or drop below 3) and the home page's lastmod.
  revalidateSitemap("agencies", "combos", "locations", "services", "pages");
  revalidatePath("/(marketing)/[service]", "page");
  revalidatePath("/(marketing)/[service]/[segment]", "page");
  revalidatePath("/");
}

/** Every directory page and the home page, e.g. after taxonomy copy changes. */
export function revalidateDirectory() {
  revalidatePath("/(marketing)/[service]", "page");
  revalidatePath("/(marketing)/[service]/[segment]", "page");
  revalidatePath("/");
}

/**
 * The one way to refresh the sitemaps: /sitemap.xml, the child sitemaps that changed (all of them
 * when none are named) and /llms.txt, which reads the same data. Call it from every write that can
 * add, remove or re-date a URL. The routes also revalidate hourly in case a write is missed (or the
 * database was edited directly).
 */
export function revalidateSitemap(...files: SitemapFile[]) {
  for (const f of files.length ? files : SITEMAP_FILES) revalidatePath(`/sitemaps/${f}.xml`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
}
