import "server-only";
import { revalidatePath } from "next/cache";

/** The profile page and every directory page it can appear on (ISR, docs/SEO.md). */
export function revalidateAgency(slug: string) {
  revalidatePath(`/agency/${slug}`);
  revalidatePath(`/og/agency/${slug}`);
  // A thin profile that was fixed (or emptied) joins or leaves the sitemaps and llms.txt.
  revalidateSitemaps();
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

/** /sitemap.xml, every child sitemap and /llms.txt (they all read the same data). */
export function revalidateSitemaps() {
  for (const f of ["pages", "services", "combos", "locations", "agencies", "guides", "authors"])
    revalidatePath(`/sitemaps/${f}.xml`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
}
