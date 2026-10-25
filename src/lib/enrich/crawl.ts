// One agency's site: the homepage, then up to 3 about/work/clients/industries pages. Returns the
// pages' visible text only (no HTML is kept). Tested (tests/enrich.test.mjs).
import { Blocked, createFetcher, extractLinks, htmlToText, pickInnerPages } from "./fetch.ts";
import type { Page } from "./match.ts";

export type CrawlResult =
  | { outcome: "ok"; pages: Page[] }
  | { outcome: "blocked" | "failed"; pages: Page[]; detail: string };

/** "acme.com" → "https://acme.com/"; anything that isn't a plain web address → null. */
export function homeUrl(website: string) {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(website) ? website : `https://${website}`);
    return u.protocol === "http:" || u.protocol === "https:" ? `${u.origin}/` : null;
  } catch {
    return null;
  }
}

export async function crawlAgency(
  website: string,
  deps: Parameters<typeof createFetcher>[1] = {},
): Promise<CrawlResult> {
  const home = homeUrl(website);
  if (!home) return { outcome: "failed", pages: [], detail: "not a web address" };
  const fetcher = createFetcher(home, deps);
  const pages: Page[] = [];
  const reason = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);
  let first;
  try {
    first = await fetcher.get(home);
  } catch (e) {
    return { outcome: e instanceof Blocked ? "blocked" : "failed", pages, detail: reason(e) };
  }
  if (!first) return { outcome: "failed", pages, detail: "homepage didn't load as HTML" };
  pages.push({ url: first.url, text: htmlToText(first.html) });
  for (const url of pickInnerPages(extractLinks(first.html, first.url), first.url)) {
    try {
      const page = await fetcher.get(url);
      if (page) pages.push({ url: page.url, text: htmlToText(page.html) });
    } catch {
      // One inner page failing (or disallowed) doesn't spoil the rest.
    }
  }
  return { outcome: "ok", pages };
}
