import { ImageResponse } from "next/og";

import { OgBrand } from "@/lib/seo/og";
import { BRAND_NAME } from "@/lib/site";

// Default social image for every route. Routes can override with their own opengraph-image.tsx.
export const alt = `${BRAND_NAME}: find the right YouTube agency`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 96,
        background: "#ffffff",
        color: "#1d1d1f",
      }}
    >
      <OgBrand size={40} />
      <div style={{ fontSize: 80, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 24 }}>
        Find the right YouTube agency
      </div>
      <div style={{ fontSize: 36, color: "#6e6e73", marginTop: 24 }}>
        By service, industry and location
      </div>
    </div>,
    size,
  );
}
