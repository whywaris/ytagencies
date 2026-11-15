import "server-only";
import { revalidatePath } from "next/cache";

import { SITEMAP_FILES, type SitemapFile } from "@/lib/sitemap-core";

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
