import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { SITEMAP_FILES, sitemapEntries } from "@/lib/sitemap";

// Cached across pages for an hour: every agency profile and guide reads this, and rebuilding the
// whole sitemap per page (~1,000 pages at build) timed out Supabase statements.
const livePathList = unstable_cache(
  async () => {
    const files = await Promise.all(SITEMAP_FILES.map((f) => sitemapEntries(f)));
    return files.flat().map((e) => e.path);
  },
  ["live-paths"],
  { revalidate: 3600 },
);

/**
 * Every live, indexable path: exactly what the sitemaps list (the same rules as each page's
 * robots meta). Internal-linking blocks filter their links through it (liveOnly, sitemap-core).
 */
export const getLivePaths = cache(async () => new Set(await livePathList()));
