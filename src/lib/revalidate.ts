import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

import { SITEMAP_FILES, type SitemapFile } from "@/lib/sitemap-core";

/**
 * One agency's own pages, after a change that only shows there: its description, logo, case studies,
 * reviews. Its cards on directory pages catch up within those pages' `revalidate`. The agencies
 * sitemap too: fixing a thin profile makes it indexable straight away.
 */
export function revalidateAgency(slug: string) {
  revalidatePath(`/agency/${slug}`);
  revalidatePath(`/og/agency/${slug}`);
  revalidateSitemap("agencies");
}

/**
 * Its own pages and every directory page it can appear on, after a change to where it's listed or
 * how it ranks: publishing, unpublishing, services, industries, places, price, plan, Verified. Each
 * call makes the whole directory rebuild as it's visited (ISR writes), so use revalidateAgency when
 * that's enough.
 */
export function revalidateAgencyListings(slug: string) {
  revalidatePath(`/agency/${slug}`);
  revalidatePath(`/og/agency/${slug}`);
  // expire: 0, so the pages below rebuild from the new list, not a stale copy (lib/data/browse.ts).
  revalidateTag("browse-pool", { expire: 0 });
  // A combo can reach or drop below 3, and the home page's lastmod moves.
  revalidateSitemap();
  revalidatePath("/(marketing)/[service]", "page");
  revalidatePath("/(marketing)/[service]/[segment]", "page");
  revalidatePath("/agencies");
  revalidatePath("/(marketing)/industries/[industry]", "page");
  revalidatePath("/(marketing)/locations/[country]", "page");
  revalidatePath("/(marketing)/locations/[country]/[city]", "page");
  revalidatePath("/(marketing)/[service]/[segment]/[location]", "page");
  revalidatePath("/");
}

/** Every directory page and the home page, e.g. after taxonomy copy changes. */
export function revalidateDirectory() {
  revalidateTag("browse-pool", { expire: 0 });
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
