import type { Metadata } from "next";

import { BRAND_NAME } from "@/lib/site";

type PageMetadata = {
  /** Full title incl. brand, ≤ 60 chars (docs/SEO.md). Used as-is, not run through the layout template. */
  title: string;
  /** 140–160 chars, specific, with the agency count where relevant. */
  description: string;
  /** Clean path without query string, e.g. "/youtube-ads-agencies". Resolved against metadataBase. */
  path: string;
  noindex?: boolean;
  /** Social image path, e.g. "/og/agency/acme-media". Defaults to the site-wide image. */
  image?: string;
};

// Pages set their own openGraph, which replaces (not merges) the parent's, so images are always
// referenced explicitly. Route-level opengraph-image files weren't picked up inside the (marketing)
// route group, so per-page images are plain route handlers under /og/ instead.
const DEFAULT_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: BRAND_NAME };

export function buildMetadata({
  title,
  description,
  path,
  noindex,
  image,
}: PageMetadata): Metadata {
  const images = [image ? { ...DEFAULT_IMAGE, url: image, alt: title } : DEFAULT_IMAGE];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      siteName: BRAND_NAME,
      title,
      description,
      url: path,
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
