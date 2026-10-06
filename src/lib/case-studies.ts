import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import { metricsToJson, type CaseStudyInput } from "@/lib/validation/dashboard";

// Case study writes, shared by the owner dashboard (user client: RLS applies) and admin (service
// role, after the admin check). Input is already validated by the caller.

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function writeCaseStudy(
  supabase: SupabaseClient<Database>,
  agencyId: string,
  input: CaseStudyInput,
): Promise<Result> {
  let industryId: number | null = null;
  if (input.industry) {
    const { data } = await supabase
      .from("industries")
      .select("id")
      .eq("slug", input.industry)
      .maybeSingle();
    if (!data) return { ok: false, error: "That industry no longer exists. Reload the page." };
    industryId = data.id;
  }
  const row = {
    title: input.title,
    client_industry_id: industryId,
    channel_url: input.channelUrl || null,
    summary: input.summary || null,
    metrics: metricsToJson(input.metrics),
  };

  // Updates are scoped to this agency, so an id from another agency matches nothing.
  const { data, error } = input.id
    ? await supabase
        .from("case_studies")
        .update(row)
        .eq("id", input.id)
        .eq("agency_id", agencyId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("case_studies")
        .insert({ ...row, agency_id: agencyId })
        .select("id")
        .single();
  if (error || !data)
    return { ok: false, error: "We couldn't save that. Please try again in a minute." };
  return { ok: true, id: data.id };
}

export async function removeCaseStudy(
  supabase: SupabaseClient<Database>,
  agencyId: string,
  caseStudyId: string,
) {
  const { error } = await supabase
    .from("case_studies")
    .delete()
    .eq("id", caseStudyId)
    .eq("agency_id", agencyId);
  return !error;
}
