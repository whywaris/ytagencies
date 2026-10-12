import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import { getIndustries, getLocations, getServices } from "@/lib/data/taxonomy";
import { AD_SPENDS, MIN_CONTRACTS } from "@/lib/pricing";
import { PRICING_MODELS, type ProfileInput } from "@/lib/validation/dashboard";

// Saves the editable profile fields and the service/industry/location links. Shared by the owner
// dashboard (user client: RLS + column grants apply) and admin (service role, after the admin check).

const SAVE_FAILED = "We couldn't save that. Please try again in a minute.";

/** Returns an error message, or null on success. */
export async function applyProfile(
  supabase: SupabaseClient<Database>,
  agencyId: string,
  input: ProfileInput,
): Promise<string | null> {
  const [services, industries, locations] = await Promise.all([
    supabase.from("services").select("id, slug"),
    supabase.from("industries").select("id, slug"),
    supabase.from("locations").select("id, slug"),
  ]);
  if (services.error || industries.error || locations.error) return SAVE_FAILED;
  const idsFor = (rows: { id: number; slug: string }[], slugs: string[]) => {
    const map = new Map(rows.map((r) => [r.slug, r.id]));
    const ids = slugs.map((s) => map.get(s));
    return ids.every((id) => id !== undefined) ? (ids as number[]) : null;
  };
  const serviceIds = idsFor(services.data, input.services);
  const industryIds = idsFor(industries.data, input.industries);
  const locationIds = idsFor(locations.data, input.locations);
  if (!serviceIds || !industryIds || !locationIds)
    return "Some options no longer exist. Reload the page.";
  const primaryServiceId = idsFor(services.data, [input.primaryService || input.services[0]])![0];
  const primaryIndustryId = input.primaryIndustry
    ? idsFor(industries.data, [input.primaryIndustry])![0]
    : null;

  const { error } = await supabase
    .from("agencies")
    .update({
      description: input.description || null,
      min_budget_usd: input.minBudget === "" ? null : Number(input.minBudget),
      pricing_model: input.pricingModel || null,
      min_contract: input.minContract || null,
      ad_spend: input.adSpend || null,
      setup_fee_usd: input.setupFee === "" ? null : Number(input.setupFee),
      updated_at: new Date().toISOString(),
    })
    .eq("id", agencyId);
  if (error) return SAVE_FAILED;

  // Upsert the wanted rows first, then delete the rest: a failure leaves extra rows, never none.
  const results = await Promise.all([
    syncServices(supabase, agencyId, serviceIds, primaryServiceId),
    syncIndustries(supabase, agencyId, industryIds, primaryIndustryId),
    syncLocations(supabase, agencyId, locationIds),
  ]);
  if (results.some(Boolean)) return SAVE_FAILED;
  return null;
}

type Supa = SupabaseClient<Database>;
const notIn = (ids: number[]) => `(${ids.join(",")})`;

async function syncServices(supabase: Supa, agencyId: string, ids: number[], primary: number) {
  const up = await supabase.from("agency_services").upsert(
    ids.map((id) => ({ agency_id: agencyId, service_id: id, is_primary: id === primary })),
    { onConflict: "agency_id,service_id" },
  );
  if (up.error) return up.error;
  const del = await supabase
    .from("agency_services")
    .delete()
    .eq("agency_id", agencyId)
    .not("service_id", "in", notIn(ids));
  return del.error;
}

async function syncIndustries(
  supabase: Supa,
  agencyId: string,
  ids: number[],
  primary: number | null,
) {
  if (ids.length > 0) {
    const up = await supabase.from("agency_industries").upsert(
      ids.map((id) => ({ agency_id: agencyId, industry_id: id, is_primary: id === primary })),
      { onConflict: "agency_id,industry_id" },
    );
    if (up.error) return up.error;
  }
  const q = supabase.from("agency_industries").delete().eq("agency_id", agencyId);
  const del = ids.length > 0 ? await q.not("industry_id", "in", notIn(ids)) : await q;
  return del.error;
}

async function syncLocations(supabase: Supa, agencyId: string, ids: number[]) {
  if (ids.length > 0) {
    const up = await supabase.from("agency_locations").upsert(
      ids.map((id) => ({ agency_id: agencyId, location_id: id })),
      { onConflict: "agency_id,location_id" },
    );
    if (up.error) return up.error;
  }
  const q = supabase.from("agency_locations").delete().eq("agency_id", agencyId);
  const del = ids.length > 0 ? await q.not("location_id", "in", notIn(ids)) : await q;
  return del.error;
}

/** Props for <ProfileForm>: current values plus the option lists. */
export async function profileFormProps(
  supabase: SupabaseClient<Database>,
  agency: {
    id: string;
    description: string | null;
    min_budget_usd: number | null;
    pricing_model: string | null;
    min_contract: string | null;
    ad_spend: string | null;
    setup_fee_usd: number | null;
  },
) {
  const [services, industries, locations, links] = await Promise.all([
    getServices(),
    getIndustries(),
    getLocations(),
    supabase
      .from("agencies")
      .select(
        "agency_services(is_primary, services(slug)), agency_industries(is_primary, industries(slug)), agency_locations(locations(slug))",
      )
      .eq("id", agency.id)
      .single(),
  ]);
  if (links.error) throw new Error("Couldn't load the listing");

  const svc = links.data.agency_services;
  const ind = links.data.agency_industries;
  const defaults: ProfileInput = {
    description: agency.description ?? "",
    minBudget: agency.min_budget_usd?.toString() ?? "",
    pricingModel: (PRICING_MODELS as readonly string[]).includes(agency.pricing_model ?? "")
      ? (agency.pricing_model as ProfileInput["pricingModel"])
      : "",
    minContract: (MIN_CONTRACTS as readonly string[]).includes(agency.min_contract ?? "")
      ? (agency.min_contract as ProfileInput["minContract"])
      : "",
    adSpend: (AD_SPENDS as readonly string[]).includes(agency.ad_spend ?? "")
      ? (agency.ad_spend as ProfileInput["adSpend"])
      : "",
    setupFee: agency.setup_fee_usd?.toString() ?? "",
    services: svc.map((r) => r.services.slug),
    primaryService: svc.find((r) => r.is_primary)?.services.slug ?? "",
    industries: ind.map((r) => r.industries.slug),
    primaryIndustry: ind.find((r) => r.is_primary)?.industries.slug ?? "",
    locations: links.data.agency_locations.map((r) => r.locations.slug),
  };
  const option = ({ slug, name }: { slug: string; name: string }) => ({ slug, name });
  const countries = locations
    .filter((l) => l.type === "country")
    .map((c) => ({
      ...option(c),
      cities: locations.filter((l) => l.parentId === c.id).map(option),
    }));
  return {
    defaults,
    services: services.map(option),
    industries: industries.map(option),
    countries,
  };
}
