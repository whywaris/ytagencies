// Guide slugs, importable anywhere (the proxy can't pull in the MDX registry). Keep in sync with
// registry.ts; its `satisfies` check fails the build if they drift.
export const GUIDE_SLUGS = ["youtube-ads-agency-cost"] as const;
export type GuideSlug = (typeof GUIDE_SLUGS)[number];
