import { ImageResponse } from "next/og";

import { BRAND_NAME } from "@/lib/site";

// Shared 1200×630 social image (DESIGN.md light tokens; no gradients, one accent).
export const OG_SIZE = { width: 1200, height: 630 };

export function ogImage({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  const titleSize = title.length > 60 ? 60 : title.length > 40 ? 68 : 80;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 88,
        background: "#ffffff",
        color: "#1d1d1f",
      }}
    >
      <div style={{ fontSize: 36, fontWeight: 600, color: "#0b57d0" }}>{BRAND_NAME}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 34, color: "#6e6e73", lineHeight: 1.3 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ display: "flex", height: 48 }}>
        {badge && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 22px",
              borderRadius: 999,
              border: "2px solid #188038",
              color: "#188038",
              fontSize: 26,
            }}
          >
            {badge}
          </div>
        )}
      </div>
    </div>,
    OG_SIZE,
  );
}
