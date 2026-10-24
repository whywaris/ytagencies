import "server-only";

import { LeadFallbackEmail } from "@/emails/lead-fallback";
import { getPlacement } from "@/lib/data/placement";
import { getMailer, oneLine } from "@/lib/email";
import { fallbackDue, FALLBACK_HOURS, previewCountry } from "@/lib/lead-preview";
import { matchAgencies, notifyAgency } from "@/lib/leads";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BUDGET_RANGES,
  budgetLabel,
  choiceLabel,
  GOALS,
  START_TIMELINES,
} from "@/lib/validation/lead";

const HOUR = 3_600_000;

/**
 * Profile requests the agency didn't open or answer as Pro within 48 hours go to up to 3 similar
 * Pro agencies (lib/match.ts), with the visitor's consent, once; the visitor is told who. Runs
 * from the daily cron, so a request moves on 48–72 hours after it was sent. Requests older than
 * 30 days are left alone.
 */
export async function runLeadFallbacks(now = new Date()) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("leads")
    .select(
      "id, name, email, company, agency_id, consent_fallback, fallback_at, created_at, service_id, industry_id, budget_range, goal, start_timeline, customer_location, message, summary, services(name), industries(name), lead_routes(agency_id, opened_at, contacted_at)",
    )
    .not("agency_id", "is", null)
    .eq("consent_fallback", true)
    .is("fallback_at", null)
    .lte("created_at", new Date(now.getTime() - FALLBACK_HOURS * HOUR).toISOString())
    .gt("created_at", new Date(now.getTime() - 30 * 24 * HOUR).toISOString());
  if (error) throw error;

  const placement = await getPlacement();
  const mailer = getMailer();
  let routed = 0;
  for (const lead of data) {
    const route = lead.lead_routes.find((r) => r.agency_id === lead.agency_id);
    const due = fallbackDue(
      {
        sentAt: lead.created_at,
        consent: lead.consent_fallback,
        fallbackAt: lead.fallback_at,
        managed: placement.entitlements(lead.agency_id!).managed,
        openedAt: route?.opened_at ?? null,
        contactedAt: route?.contacted_at ?? null,
      },
      now,
    );
    if (!due || !lead.service_id || !lead.industry_id) continue;

    // Claim it first, so two runs can't both send it on.
    const { data: claimed } = await db
      .from("leads")
      .update({ fallback_at: new Date().toISOString() })
      .eq("id", lead.id)
      .is("fallback_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const budgetMax = BUDGET_RANGES.find((b) => b.value === lead.budget_range)?.max ?? Infinity;
    const already = new Set(lead.lead_routes.map((r) => r.agency_id));
    const agencies = (await matchAgencies(lead.service_id, lead.industry_id, budgetMax)).filter(
      (a) => !already.has(a.id),
    );
    if (agencies.length === 0) continue;
    const { error: routesError } = await db
      .from("lead_routes")
      .insert(agencies.map((a) => ({ lead_id: lead.id, agency_id: a.id, via: "fallback" })));
    if (routesError) {
      console.error("fallback routes insert failed", { leadId: lead.id });
      continue;
    }
    routed++;
    if (!mailer) continue;

    const service = lead.services?.name ?? null;
    const industry = lead.industries?.name ?? null;
    const need = [service, industry].filter(Boolean).join(" for ");
    await Promise.all(
      agencies.map((agency) =>
        notifyAgency(mailer, agency, true, {
          leadId: lead.id,
          direct: false,
          lead: {
            name: lead.name,
            email: lead.email,
            company: lead.company,
            budget: budgetLabel(lead.budget_range),
            need,
            message: lead.message,
            details: [
              ["Main goal", choiceLabel(GOALS, lead.goal)],
              ["Wants to start", choiceLabel(START_TIMELINES, lead.start_timeline)],
              ["Country", lead.customer_location],
            ],
          },
          preview: {
            service,
            industry,
            budget: budgetLabel(lead.budget_range),
            timeline: choiceLabel(START_TIMELINES, lead.start_timeline),
            goal: choiceLabel(GOALS, lead.goal),
            country: previewCountry(lead.customer_location),
            summary: lead.summary,
          },
        }),
      ),
    );
    const { data: first } = await db
      .from("agencies")
      .select("name")
      .eq("id", lead.agency_id!)
      .maybeSingle();
    const agencyName = first?.name ?? "The agency";
    const { error: sendError } = await mailer.send({
      from: mailer.from,
      to: lead.email,
      subject: oneLine(`We've sent your request to ${agencies.length} similar agencies`),
      react: (
        <LeadFallbackEmail
          name={lead.name}
          agencyName={agencyName}
          agencies={agencies.map((a) => ({ name: a.name, url: absoluteUrl(`/agency/${a.slug}`) }))}
        />
      ),
    });
    if (sendError) console.error("fallback notice failed", { leadId: lead.id });
  }
  return { routed };
}
