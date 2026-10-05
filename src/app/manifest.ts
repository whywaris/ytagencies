import type { MetadataRoute } from "next";

import { BRAND_NAME } from "@/lib/site";

// Colors: docs/DESIGN.md light tokens (--bg, --accent).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: "Find the right YouTube agency by service, industry and location.",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/logo.png", type: "image/png", sizes: "512x512" },
    ],
  };
}
