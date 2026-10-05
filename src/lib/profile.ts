import type { AgencyProfile } from "@/lib/data/agencies";
import type { Json } from "@/lib/supabase/types";
import { firstThatFits } from "@/lib/directory";
import { BRAND_NAME } from "@/lib/site";

// Copy and formatting for agency profiles. Pure functions, no data access.

export const PRICING_LABEL: Record<string, string> = {
  retainer: "Monthly retainer",
  per_video: "Per video",
  project: "Per project",
  performance: "Performance-based",
};

/** "Quillfern Media: YouTube Ads agency in Austin | Brand", shortened to fit 60 chars. */
export function profileTitle(agency: AgencyProfile) {
  const service = agency.services[0]?.name;
  const where = agency.hq ? ` in ${agency.hq.name}` : "";
  const what = service ? `${service} agency` : "YouTube agency";
  return firstThatFits(
    [
      `${agency.name}: ${what}${where} | ${BRAND_NAME}`,
      `${agency.name}: ${what}${where}`,
      `${agency.name}: ${what}`,
      agency.name,
    ],
    60,
  );
}

/** Agency description cut at a word boundary to ≤ 160 chars, or a fact-based fallback. */
export function profileDescription(agency: AgencyProfile) {
  const text = agency.description?.replace(/\s+/g, " ").trim();
  if (text && text.length >= 140) {
    if (text.length <= 160) return text;
    const cut = text.slice(0, 157);
    return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
  }
  const services = agency.services.map((s) => s.name).join(", ");
  const industries = agency.industries.map((i) => i.name).join(", ");
  return `${agency.name} offers ${services || "YouTube services"}${industries ? ` for ${industries}` : ""}. See case studies, reviews and minimum budget, then contact them directly.`;
}

const WORDS: Record<string, string> = {
  roas: "ROAS",
  ctr: "CTR",
  subs: "Subscribers",
  avg: "Average",
};
const UNITS: Record<string, (n: number) => string> = {
  usd: (n) => `$${n.toLocaleString("en-US")}`,
  gbp: (n) => `£${n.toLocaleString("en-US")}`,
  pct: (n) => `${n}%`,
};

/**
 * Case-study metrics JSON → display pairs. Unit comes from the key suffix:
 * {"cost_per_booking_usd": 48} → ["Cost per booking", "$48"], {"roas": 3.2} → ["ROAS", "3.2×"].
 */
export function formatMetrics(metrics: Json | null): [label: string, value: string][] {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return [];
  // jsonb stores keys shortest-first, so "x_after" can precede "x_before"; put before/after pairs back in order.
  const rank = (k: string) => (/_before(_|$)/.test(k) ? 0 : /_after(_|$)/.test(k) ? 1 : 0);
  const stem = (k: string) => k.replace(/_(before|after)(?=_|$)/, "");
  const entries = Object.entries(metrics).sort(
    ([a], [b]) => stem(a).localeCompare(stem(b)) || rank(a) - rank(b),
  );
  return entries.flatMap(([key, value]) => {
    if (typeof value !== "number" && typeof value !== "string") return [];
    const parts = key.split("_");
    const unit = UNITS[parts[parts.length - 1]] ? parts.pop()! : null;
    const label = parts
      .map((w, i) => WORDS[w] ?? (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
    const formatted =
      typeof value === "string"
        ? value
        : unit
          ? UNITS[unit](value)
          : key.startsWith("roas")
            ? `${value}×`
            : value.toLocaleString("en-US");
    return [[label, formatted] as [string, string]];
  });
}

/** Owner-edited URLs: allow only http(s) so a stored "javascript:" link can't run (SECURITY.md). */
export function safeExternalUrl(raw: string | null) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}
