import type { MDXContent } from "mdx/types";

import type { GuideSlug } from "@/content/guides/slugs";

// Trusted, repo-reviewed guides only (SECURITY.md). Add a guide: create <slug>.mdx exporting `meta`,
// then list it here. Slugs never change after publish.

export type GuideMeta = {
  title: string; // H1 and the base of the <title>
  description: string; // 140–160 chars
  published: string; // YYYY-MM-DD
  updated: string; // YYYY-MM-DD, drives the sitemap lastModified
  author: string;
  related: { href: string; label: string }[]; // 2–3 directory pages (docs/SEO.md)
};

type GuideModule = { default: MDXContent; meta: GuideMeta };

// The generic *.mdx module type doesn't know about `meta`; each guide file must export it.
const guide = (load: () => Promise<unknown>) => load as () => Promise<GuideModule>;

export const GUIDES: Record<string, () => Promise<GuideModule>> = {
  "youtube-ads-agency-cost": guide(() => import("./youtube-ads-agency-cost.mdx")),
} satisfies Record<GuideSlug, () => Promise<GuideModule>>;
