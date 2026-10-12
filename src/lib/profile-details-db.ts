import type { Json } from "@/lib/supabase/types";
import {
  EMPTY_SERVICE_DETAIL,
  includedLines,
  REPORTING_FREQUENCIES,
  type ServiceDetail,
} from "@/lib/validation/profile-details";
import { PRICING_MODELS } from "@/lib/pricing";

// Profile details: validated form values ↔ database columns. Used by the profile save (owner and
// admin), the submission action, and the form defaults.

type Details = {
  bestFor: string;
  timezone: string;
  youtubeChannelUrl: string;
  linkedinUrl: string;
  reportingFrequency: string;
  process: { title: string; description: string }[];
  serviceDetails: Record<string, ServiceDetail>;
  industryFocus: Record<string, string>;
};

const orNull = (v: string) => (v === "" ? null : v);
const intOrNull = (v: string | undefined) =>
  v === undefined || v.trim() === "" ? null : Number(v);

/** agencies columns. */
export function detailsColumns(d: Details) {
  return {
    best_for: orNull(d.bestFor),
    timezone: orNull(d.timezone),
    youtube_channel_url: orNull(d.youtubeChannelUrl),
    linkedin_url: orNull(d.linkedinUrl),
    reporting_frequency: orNull(d.reportingFrequency),
    process: d.process.map((s) => ({ title: s.title, description: s.description })) as Json,
  };
}

/** agency_services columns for one chosen service. A price without a unit uses the main one. */
export function serviceColumns(d: Details, slug: string, mainUnit: string | null) {
  const s = d.serviceDetails[slug] ?? EMPTY_SERVICE_DETAIL;
  const price = intOrNull(s.price);
  return {
    focus_pct: intOrNull(s.focus),
    included: includedLines(s.included),
    starting_price: price,
    price_unit: price === null ? null : s.unit || mainUnit,
  };
}

/** agency_industries columns for one chosen industry. */
export const industryColumns = (d: Details, slug: string) => ({
  focus_pct: intOrNull(d.industryFocus[slug]),
});

type Unit = (typeof PRICING_MODELS)[number];
const asUnit = (v: string | null): "" | Unit =>
  (PRICING_MODELS as readonly string[]).includes(v ?? "") ? (v as Unit) : "";

/** Saved values → form defaults. */
export function detailsDefaults(
  agency: {
    best_for: string | null;
    timezone: string | null;
    youtube_channel_url: string | null;
    linkedin_url: string | null;
    reporting_frequency: string | null;
    process: Json;
  },
  services: {
    slug: string;
    focus_pct: number | null;
    included: string[];
    starting_price: number | null;
    price_unit: string | null;
  }[],
  industries: { slug: string; focus_pct: number | null }[],
  mainUnit: string | null,
) {
  const steps = Array.isArray(agency.process) ? agency.process : [];
  return {
    bestFor: agency.best_for ?? "",
    timezone: agency.timezone ?? "",
    youtubeChannelUrl: agency.youtube_channel_url ?? "",
    linkedinUrl: agency.linkedin_url ?? "",
    reportingFrequency: (REPORTING_FREQUENCIES as readonly string[]).includes(
      agency.reporting_frequency ?? "",
    )
      ? (agency.reporting_frequency as (typeof REPORTING_FREQUENCIES)[number])
      : ("" as const),
    process: steps.flatMap((s) =>
      s && typeof s === "object" && !Array.isArray(s) && typeof s.title === "string"
        ? [{ title: s.title, description: typeof s.description === "string" ? s.description : "" }]
        : [],
    ),
    serviceDetails: Object.fromEntries(
      services.map((s) => [
        s.slug,
        {
          focus: s.focus_pct?.toString() ?? "",
          included: s.included.join("\n"),
          price: s.starting_price?.toString() ?? "",
          // Shown as "Same as your main price" when it matches.
          unit: s.price_unit === mainUnit ? "" : asUnit(s.price_unit),
        },
      ]),
    ),
    industryFocus: Object.fromEntries(
      industries.map((i) => [i.slug, i.focus_pct?.toString() ?? ""]),
    ),
  };
}
