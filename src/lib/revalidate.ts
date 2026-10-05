import "server-only";
import { revalidatePath } from "next/cache";

/** The profile page and every directory page it can appear on (ISR, docs/SEO.md). */
export function revalidateAgency(slug: string) {
  revalidatePath(`/agency/${slug}`);
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
