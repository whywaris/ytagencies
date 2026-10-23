import "server-only";
import { cache } from "react";

import { SITEMAP_FILES, sitemapEntries } from "@/lib/sitemap";

/**
 * Every live, indexable path: exactly what the sitemaps list (the same rules as each page's
 * robots meta). Internal-linking blocks filter their links through it (liveOnly, sitemap-core).
 */
export const getLivePaths = cache(async () => {
  const files = await Promise.all(SITEMAP_FILES.map((f) => sitemapEntries(f)));
  return new Set(files.flat().map((e) => e.path));
});
