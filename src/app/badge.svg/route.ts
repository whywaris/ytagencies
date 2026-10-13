import { BRAND_NAME } from "@/lib/site";

// The "Listed on YT Agencies" badge agencies put on their site (Dashboard → Badge). Static; the
// mark is the logo's, never YouTube's (CLAUDE.md).
export const dynamic = "force-static";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="40" viewBox="0 0 180 40" role="img" aria-label="Listed on ${BRAND_NAME}">
<rect x=".5" y=".5" width="179" height="39" rx="11.5" fill="#fff" stroke="#E2E3E8"/>
<rect x="8" y="9" width="22" height="22" rx="6" fill="#1F5EFF"/>
<path d="M13.5 15.9h11M13.5 20h11M13.5 24.1h6.9" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/>
<text x="38" y="25" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" font-size="13" font-weight="600" fill="#16171A">Listed on ${BRAND_NAME}</text>
</svg>`;

export function GET() {
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
