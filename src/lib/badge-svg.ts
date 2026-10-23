// The badges agencies put on their site (Dashboard → Badge): "Listed on" for every claimed
// listing, "Verified on" for verified agencies (any plan). The embed code links to the profile,
// which shows the real status. The mark is the logo's, never YouTube's (CLAUDE.md); the green is
// --verified (light theme).
import { BRAND_NAME } from "@/lib/site";

export const BADGES = {
  listed: { path: "/badge.svg", label: `Listed on ${BRAND_NAME}`, width: 180 },
  verified: { path: "/badge-verified.svg", label: `Verified on ${BRAND_NAME}`, width: 196 },
} as const;
export type BadgeKind = keyof typeof BADGES;

export function badgeSvg(kind: BadgeKind) {
  const { label, width } = BADGES[kind];
  const mark =
    kind === "verified"
      ? `<rect x="8" y="9" width="22" height="22" rx="11" fill="#188038"/>
<path d="M13.6 20.2l3.9 3.9 7-7.6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<rect x="8" y="9" width="22" height="22" rx="6" fill="#1F5EFF"/>
<path d="M13.5 15.9h11M13.5 20h11M13.5 24.1h6.9" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40" viewBox="0 0 ${width} 40" role="img" aria-label="${label}">
<rect x=".5" y=".5" width="${width - 1}" height="39" rx="11.5" fill="#fff" stroke="#E2E3E8"/>
${mark}
<text x="38" y="25" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" font-size="13" font-weight="600" fill="#16171A">${label}</text>
</svg>`;
}

export const badgeResponse = (kind: BadgeKind) =>
  new Response(badgeSvg(kind), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000",
      "X-Content-Type-Options": "nosniff",
    },
  });
