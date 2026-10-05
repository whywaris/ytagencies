import { markImage } from "@/lib/seo/og";

// Raster logo for Organization JSON-LD (Google wants ≥ 112×112) and email headers.
export const dynamic = "force-static";

export function GET() {
  return markImage(512);
}
