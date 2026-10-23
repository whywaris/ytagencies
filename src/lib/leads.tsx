import "server-only";
import { after } from "next/server";

import { AdminLeadEmail } from "@/emails/admin-lead";
import { AgencyLeadEmail } from "@/emails/agency-lead";
import { LeadConfirmationEmail } from "@/emails/lead-confirmation";
import { getMailer, oneLine } from "@/lib/email";
import { getResponseTimes, listQuery, toListItem } from "@/lib/data/agencies";
import { getPlacement } from "@/lib/data/placement";
import { pickMatches } from "@/lib/match";
import { absoluteUrl, BRAND_NAME } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// Lead storage, routing and notification. Call only after every form check has passed:
// these use the service-role client, which bypasses RLS.

export type RoutedAgency = {
  id: string;
  slug: string;
  name: string;
  isClaimed: boolean;
  ownerId: string | null;
};

/**
 * Up to 3 published, managed agencies for a service + industry (lib/match.ts). Unmanaged
 * listings have nobody to answer, so they never receive a request; none at all leaves the lead
 * unrouted for the admin to follow up by hand.
 */
// ponytail: deterministic ranking sends every lead for a combo to the same top 3; add rotation
// (least recently routed first) once agencies pay per lead.
export async function matchAgencies(serviceId: number, industryId: number, budgetMax: number) {
  const admin = createAdminClient();
  const [byService, byIndustry] = await Promise.all([
    admin.from("agency_services").select("agency_id").eq("service_id", serviceId),
    admin.from("agency_industries").select("agency_id").eq("industry_id", industryId),
  ]);
  if (byService.error) throw byService.error;
  if (byIndustry.error) throw byIndustry.error;

  const serviceIds = byService.data.map((r) => r.agency_id);
  if (serviceIds.length === 0) return [];
  const inIndustry = new Set(byIndustry.data.map((r) => r.agency_id));

  // Published agencies with their quality score (the directory's own list and scoring), plus
  // who owns them, for the emails.
  const [list, owners, placement, responses] = await Promise.all([
    listQuery().in("id", serviceIds),
    admin.from("agencies").select("id, is_claimed, owner_id").in("id", serviceIds),
    getPlacement(),
    getResponseTimes(),
  ]);
  if (list.error) throw list.error;
  if (owners.error) throw owners.error;
  const owner = new Map(owners.data.map((o) => [o.id, o]));

  return pickMatches(
    list.data.map((row) => ({
      ...toListItem(row, placement, responses),
      inIndustry: inIndustry.has(row.id),
    })),
    budgetMax,
  ).map((a) =>
    toRouted({
      id: a.id,
      slug: a.slug,
      name: a.name,
      is_claimed: owner.get(a.id)?.is_claimed ?? false,
      owner_id: owner.get(a.id)?.owner_id ?? null,
    }),
  );
}

export async function getPublishedAgency(slug: string) {
  const { data, error } = await createAdminClient()
    .from("agencies")
    .select("id, slug, name, is_claimed, owner_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data ? toRouted(data) : null;
}

function toRouted(a: {
  id: string;
  slug: string;
  name: string;
  is_claimed: boolean;
  owner_id: string | null;
}): RoutedAgency {
  return { id: a.id, slug: a.slug, name: a.name, isClaimed: a.is_claimed, ownerId: a.owner_id };
}

type LeadRow = {
  /** Where a Request proposals request started, e.g. "profile:<slug>". */
  ref?: string | null;
  name: string;
  email: string;
  company: string | null;
  service_id: number | null;
  industry_id: number | null;
  budget_range: string | null;
  message: string | null;
  goal?: string | null;
  start_timeline?: string | null;
  business_url?: string | null;
  channel_url?: string | null;
  customer_location?: string | null;
  prior_agency?: string | null;
};

/** Inserts the lead and its routes. Returns the lead id. */
export async function saveLead(lead: LeadRow, agencies: RoutedAgency[]) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("leads").insert(lead).select("id").single();
  if (error) throw error;
  if (agencies.length > 0) {
    const routes = await admin
      .from("lead_routes")
      .insert(agencies.map((a) => ({ lead_id: data.id, agency_id: a.id })));
    // ponytail: lead + routes aren't one transaction; a failed routes insert leaves the lead unrouted.
    // The admin email still lists the intended agencies. Move into an RPC if it ever happens.
    if (routes.error) console.error("lead_routes insert failed", { leadId: data.id });
  }
  return data.id;
}

type LeadEmailInput = {
  leadId: string;
  kind: "get-matched" | "contact";
  lead: {
    name: string;
    email: string;
    company?: string | null;
    budget?: string | null;
    need?: string | null;
    message?: string | null;
    /** Request proposals answers, as [label, value] rows (empty values are left out). */
    details?: [string, string | null][];
  };
  agencies: RoutedAgency[];
};

/** Sends emails after the response is returned, so the visitor isn't kept waiting. */
export function queueLeadEmails(input: LeadEmailInput) {
  after(() =>
    sendLeadEmails(input).catch(() =>
      console.error("lead emails failed", { leadId: input.leadId }),
    ),
  );
}

async function sendLeadEmails({ leadId, kind, lead, agencies }: LeadEmailInput) {
  const mailer = getMailer();
  if (!mailer) {
    console.warn("Email not configured (RESEND_API_KEY); skipped", { leadId });
    return;
  }
  const { send, from } = mailer;
  const admin = createAdminClient();
  const direct = kind === "contact";

  // Agencies: only claimed listings have an owner to email. Others are flagged to the admin.
  const notified = await Promise.all(
    agencies.map(async (agency) => {
      if (!agency.isClaimed || !agency.ownerId) return false;
      const { data } = await admin.auth.admin.getUserById(agency.ownerId);
      const to = data.user?.email;
      if (!to) return false;
      const { error } = await send({
        from,
        to,
        replyTo: lead.email,
        subject: oneLine(`New inquiry via ${BRAND_NAME}: ${lead.company || lead.name}`),
        react: <AgencyLeadEmail agencyName={agency.name} lead={lead} direct={direct} />,
      });
      if (error) console.error("agency lead email failed", { leadId, agencyId: agency.id });
      return !error;
    }),
  );

  const confirmation = send({
    from,
    to: lead.email,
    subject: direct
      ? oneLine(`Your message to ${agencies[0]?.name ?? "the agency"}`)
      : "We've passed on your request",
    react: (
      <LeadConfirmationEmail
        name={lead.name}
        need={direct ? undefined : (lead.need ?? undefined)}
        answers={
          direct
            ? undefined
            : [
                ["Looking for", lead.need ?? null],
                ["Budget", lead.budget ?? null],
                ...(lead.details ?? []),
                ["Your message", lead.message ?? null],
              ]
        }
        agencies={agencies.map((a) => ({ name: a.name, url: absoluteUrl(`/agency/${a.slug}`) }))}
      />
    ),
  });

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminNote = adminEmail
    ? send({
        from,
        to: adminEmail,
        subject: oneLine(`New ${kind} lead: ${lead.name}`),
        react: (
          <AdminLeadEmail
            leadId={leadId}
            kind={kind}
            lead={lead}
            routes={agencies.map((a, i) => ({ name: a.name, notified: notified[i] }))}
          />
        ),
      })
    : null;

  const [c, a] = await Promise.all([confirmation, adminNote]);
  if (c.error) console.error("confirmation email failed", { leadId });
  if (a?.error) console.error("admin lead email failed", { leadId });
}
