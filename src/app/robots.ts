import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

// docs/SEO.md: keep private areas and parameterized (filtered) URLs out of the crawl.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // "/*?" also matches optimized images (/_next/image?url=…); the longer allow rule wins,
      // so logos stay fetchable. Social images live at query-free /og/… paths.
      allow: ["/", "/_next/image"],
      disallow: ["/dashboard", "/admin", "/api", "/auth", "/*?"],
    },
    sitemap: ["agencies", "categories", "guides"].map((s) => absoluteUrl(`/sitemaps/${s}.xml`)),
  };
}
