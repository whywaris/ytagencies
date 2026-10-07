import { ImageResponse } from "next/og";

import { logoMarkShapes } from "@/components/logo";
import { BRAND_NAME } from "@/lib/site";

// Shared 1200×630 social image (DESIGN.md light tokens; no gradients, one accent).
export const OG_SIZE = { width: 1200, height: 630 };

const ACCENT = "#0b57d0";
const ACCENT_DARK = "#4c8df6";

/** Mark + brand name, as in the nav. Satori can't render SVG <text>, so the name is a div. */
export function OgBrand({ size, dark = false }: { size: number; dark?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.4,
        color: dark ? "#f5f5f7" : "#1d1d1f",
      }}
    >
      <svg width={size * 1.2} height={size * 1.2} viewBox="0 0 24 24">
        {logoMarkShapes(dark ? ACCENT_DARK : ACCENT)}
      </svg>
      <div style={{ fontSize: size, fontWeight: 600, letterSpacing: "-0.02em" }}>{BRAND_NAME}</div>
    </div>
  );
}

/** Square brand mark (accent tile, white list) for the apple-touch icon and the Organization logo. */
export function markImage(px: number) {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: ACCENT }}>
      <svg width={px} height={px} viewBox="1.5 1.5 21 21">
        {logoMarkShapes("#ffffff", ACCENT)}
      </svg>
    </div>,
    { width: px, height: px },
  );
}

/** 16:9 hero cover for guides without an uploaded one. */
export const COVER_SIZE = { width: 1200, height: 675 };

/**
 * Typographic guide cover: the title on the brand surface, logo small. Used as the hero (16:9, a
 * light and a dark version) and the social image (1200×630, light) when a guide has no cover.
 * No illustrations.
 */
export function guideCoverImage(
  title: string,
  size: { width: number; height: number },
  theme: "light" | "dark" = "light",
) {
  const dark = theme === "dark";
  const titleSize = title.length > 70 ? 56 : title.length > 45 ? 64 : 76;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        // DESIGN.md surface and text tokens for the theme.
        background: dark ? "#1c1c1e" : "#f5f5f7",
        color: dark ? "#f5f5f7" : "#1d1d1f",
      }}
    >
      <OgBrand size={28} dark={dark} />
      <div
        style={{
          display: "flex",
          maxWidth: 960,
          fontSize: titleSize,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>
    </div>,
    size,
  );
}

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
      <OgBrand size={36} />
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
