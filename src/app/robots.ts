import type { MetadataRoute } from "next";

import { indexingAllowed, robotsRules } from "@/lib/indexing";
import { absoluteUrl } from "@/lib/site";

// docs/SEO.md: keep private areas and parameterized (filtered) URLs out of the crawl. Until launch
// (ALLOW_INDEXING isn't "true", lib/indexing.ts) nothing may be crawled and there's no sitemap.
export default function robots(): MetadataRoute.Robots {
  return robotsRules(
    indexingAllowed(),
    ["agencies", "categories", "guides"].map((s) => absoluteUrl(`/sitemaps/${s}.xml`)),
  );
}
