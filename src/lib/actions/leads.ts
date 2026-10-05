"use server";

import { z } from "zod";

import { clientIp, underRateLimit, verifyTurnstile } from "@/lib/forms/guard";
import { getPublishedAgency, matchAgencies, queueLeadEmails, saveLead } from "@/lib/leads";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BUDGET_RANGES,
  contactAgencySchema,
  getMatchedSchema,
  type FormResult,
} from "@/lib/validation/lead";

// Public form actions. Order (SECURITY.md): honeypot → Zod → Turnstile → rate limit → write.
// Nothing touches the database with the service role until every check has passed.

type Matched = { agencies: { name: string; slug: string }[]; need: string };
type Contacted = { agencyName: string };

const GENERIC_ERROR = "Something went wrong on our side. Please try again in a minute.";

function honeypotFilled(raw: unknown) {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "website" in raw &&
    typeof raw.website === "string" &&
    raw.website !== ""
  );
}

function invalid(error: z.ZodError): {
  ok: false;
  error: string;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, error: "Check the highlighted fields.", fieldErrors };
}

/** Turnstile + rate limit. Returns an error result, or null when the request may proceed. */
async function guard(
  token: string,
  email: string,
): Promise<{ ok: false; error: string; fieldErrors?: Record<string, string> } | null> {
  const ip = await clientIp();
  if (!(await verifyTurnstile(token, ip))) {
    return {
      ok: false,
      error: "The security check didn't pass. Please try it again.",
      fieldErrors: { turnstileToken: "Complete the security check again." },
    };
  }
  if (!(await underRateLimit(ip, email))) {
    return {
      ok: false,
      error: "You've sent several requests in the last hour. Please try again later.",
    };
  }
  return null;
}

const budgetLabel = (value: string | undefined) =>
  BUDGET_RANGES.find((b) => b.value === value)?.label ?? null;

export async function submitGetMatched(raw: unknown): Promise<FormResult<Matched>> {
  // Bots that fill the hidden field get a normal-looking success and nothing is stored.
  if (honeypotFilled(raw)) return { ok: true, data: { agencies: [], need: "" } };

  const parsed = getMatchedSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  const blocked = await guard(input.turnstileToken, input.email);
  if (blocked) return blocked;

  try {
    const admin = createAdminClient();
    const [service, industry] = await Promise.all([
      admin.from("services").select("id, name").eq("slug", input.service).maybeSingle(),
      admin.from("industries").select("id, name").eq("slug", input.industry).maybeSingle(),
    ]);
    if (!service.data || !industry.data) {
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: {
          ...(!service.data && { service: "Choose a service." }),
          ...(!industry.data && { industry: "Choose an industry." }),
        },
      };
    }

    const budgetMax = BUDGET_RANGES.find((b) => b.value === input.budget)?.max ?? Infinity;
    const agencies = await matchAgencies(service.data.id, industry.data.id, budgetMax);
    const need = `${service.data.name} for ${industry.data.name}`;

    const leadId = await saveLead(
      {
        name: input.name,
        email: input.email,
        company: input.company || null,
        service_id: service.data.id,
        industry_id: industry.data.id,
        budget_range: input.budget,
        message: input.message || null,
      },
      agencies,
    );

    queueLeadEmails({
      leadId,
      kind: "get-matched",
      lead: {
        name: input.name,
        email: input.email,
        company: input.company || null,
        budget: budgetLabel(input.budget),
        need,
        message: input.message || null,
      },
      agencies,
    });

    return {
      ok: true,
      data: { agencies: agencies.map((a) => ({ name: a.name, slug: a.slug })), need },
    };
  } catch {
    console.error("submitGetMatched failed"); // no payload in logs (SECURITY.md)
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function contactAgency(raw: unknown): Promise<FormResult<Contacted>> {
  if (honeypotFilled(raw)) return { ok: true, data: { agencyName: "" } };

  const parsed = contactAgencySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  const blocked = await guard(input.turnstileToken, input.email);
  if (blocked) return blocked;

  try {
    const agency = await getPublishedAgency(input.agencySlug);
    if (!agency) return { ok: false, error: "This agency is no longer listed." };

    const leadId = await saveLead(
      {
        name: input.name,
        email: input.email,
        company: input.company || null,
        service_id: null,
        industry_id: null,
        budget_range: input.budget || null,
        message: input.message,
      },
      [agency],
    );

    queueLeadEmails({
      leadId,
      kind: "contact",
      lead: {
        name: input.name,
        email: input.email,
        company: input.company || null,
        budget: budgetLabel(input.budget || undefined),
        message: input.message,
      },
      agencies: [agency],
    });

    return { ok: true, data: { agencyName: agency.name } };
  } catch {
    console.error("contactAgency failed");
    return { ok: false, error: GENERIC_ERROR };
  }
}
