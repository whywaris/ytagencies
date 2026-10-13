// Whether search engines may index the site: only when ALLOW_INDEXING is exactly "true" (set at
// launch, on Production only). Otherwise every response says noindex and robots.txt blocks all,
// so previews and a pre-launch production never end up in Google. No imports: next.config.ts
// and the tests load it directly.

export const indexingAllowed = (env: Record<string, string | undefined> = process.env) =>
  env.ALLOW_INDEXING === "true";

/** Headers added to every response while indexing is off. */
export const noindexHeaders = (allowed: boolean) =>
  allowed ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

/** robots.txt: everything blocked and no sitemap until launch; otherwise the normal rules. */
export function robotsRules(allowed: boolean, sitemaps: string[]) {
  if (!allowed) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      // "/*?" also matches optimized images (/_next/image?url=…); the longer allow rule wins,
      // so logos stay fetchable. Social images live at query-free /og/… paths.
      allow: ["/", "/_next/image"],
      disallow: ["/dashboard", "/admin", "/api", "/auth", "/*?"],
    },
    sitemap: sitemaps,
  };
}
