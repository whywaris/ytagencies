import type { Json } from "@/lib/supabase/types";

// Copy and formatting for agency profiles. Pure functions, no data access.

export const PRICING_LABEL: Record<string, string> = {
  retainer: "Monthly retainer",
  per_video: "Per video",
  project: "Per project",
  performance: "Performance-based",
};

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
