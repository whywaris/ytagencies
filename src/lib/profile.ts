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

/** Case-study metrics (jsonb array of {value, label}) → display pairs, e.g. ["ROAS", "4.1×"]. */
export function formatMetrics(metrics: Json | null): [label: string, value: string][] {
  if (!Array.isArray(metrics)) return [];
  return metrics.flatMap((m) =>
    m &&
    typeof m === "object" &&
    !Array.isArray(m) &&
    typeof m.value === "string" &&
    typeof m.label === "string"
      ? [[m.label, m.value] as [string, string]]
      : [],
  );
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
