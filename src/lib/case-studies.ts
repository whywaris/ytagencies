import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import type { CaseStudyInput } from "@/lib/validation/dashboard";
import { resolveChannelId } from "@/lib/youtube-url";

// Case study writes, shared by the owner dashboard (user client: RLS applies) and admin (service
// role, after the admin check). Input is already validated by the caller. The channel link is
// resolved to a channel ID here, once, so pages (the home hero) match on the stored ID and never
// call YouTube while they build.

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
  let serviceId: number | null = null;
  if (input.service) {
    const { data } = await supabase
      .from("services")
      .select("id")
      .eq("slug", input.service)
      .maybeSingle();
    if (!data) return { ok: false, error: "That service no longer exists. Reload the page." };
    serviceId = data.id;
  }
  const channelUrl = input.channelUrl || null;
  let channelId: string | null = null;
  if (channelUrl) {
    // An unchanged link keeps its ID, so a YouTube outage can't clear it.
    const { data: before } = input.id
      ? await supabase
          .from("case_studies")
          .select("channel_url, channel_id")
          .eq("id", input.id)
          .eq("agency_id", agencyId)
          .maybeSingle()
      : { data: null };
    channelId =
      before?.channel_url === channelUrl && before.channel_id
        ? before.channel_id
        : await resolveChannelId(channelUrl, process.env.YOUTUBE_API_KEY);
  }
  const row = {
    title: input.title,
    client_industry_id: industryId,
    service_id: serviceId,
    channel_url: channelUrl,
    channel_id: channelId,
    summary: input.summary || null,
    metrics: input.metrics,
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

/**
 * Resolves the channel links of an agency's case studies that have no channel ID yet (saved
 * before IDs were stored, or while YouTube was unreachable). Run when a verification is saved.
 */
export async function resolveCaseStudyChannels(
  supabase: SupabaseClient<Database>,
  agencyId: string,
) {
  const { data } = await supabase
    .from("case_studies")
    .select("id, channel_url")
    .eq("agency_id", agencyId)
    .is("channel_id", null)
    .not("channel_url", "is", null)
    .limit(50);
  for (const study of data ?? []) {
    const channelId = await resolveChannelId(study.channel_url!, process.env.YOUTUBE_API_KEY);
    if (channelId)
      await supabase.from("case_studies").update({ channel_id: channelId }).eq("id", study.id);
  }
}
