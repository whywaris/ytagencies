"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";

import { AdminSubmissionEmail } from "@/emails/admin-submission";
import { ClaimVerificationEmail } from "@/emails/claim-verification";
import { getUser } from "@/lib/auth";
import { createClaimToken, emailMatchesWebsite } from "@/lib/claims";
import { getMailer, oneLine } from "@/lib/email";
import { clientIp, underRateLimit, verifyTurnstile } from "@/lib/forms/guard";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, createStaticClient } from "@/lib/supabase/server";
import type { FormResult } from "@/lib/validation/lead";
import { agencySearchSchema, submitAgencySchema } from "@/lib/validation/listing";

// /list-your-agency. SECURITY.md: ownership is never auto-granted. A submission is a draft with no
// owner; the submitter becomes owner only via the claims flow (domain-matched email) or an admin.

export type FoundAgency = {
  slug: string;
  name: string;
  website: string | null;
  isClaimed: boolean;
};

/** "https://www.acme.com/about" or "acme.com" → "acme.com"; null if it doesn't look like a domain. */
function hostFrom(input: string) {
  try {
    const host = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`).hostname;
    return host.includes(".") ? host.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/** Published agencies whose name or website matches. Public data, anon client. */
export async function searchAgencies(raw: string): Promise<FoundAgency[]> {
  const parsed = agencySearchSchema.safeParse(raw);
  if (!parsed.success) return [];
  // Only characters that can't break PostgREST's or() syntax or act as LIKE wildcards.
  const term = parsed.data.replace(/[^\p{L}\p{N} .-]/gu, " ").trim();
  if (term.length < 2) return [];
  const host = hostFrom(parsed.data)?.replace(/[^a-z0-9.-]/g, "");
  const filters = [`name.ilike.*${term}*`];
  if (host) filters.push(`website.ilike.*${host}*`);

  const { data, error } = await createStaticClient()
    .from("agencies")
    .select("slug, name, website, is_claimed")
    .eq("status", "published")
    .or(filters.join(","))
    .order("name")
    .limit(8);
  if (error) {
    console.error("agency search failed");
    return [];
  }
  return data.map((a) => ({
    slug: a.slug,
    name: a.name,
    website: a.website,
    isClaimed: a.is_claimed,
  }));
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "") || "agency";

type Submitted = { kind: "verify" | "review"; workEmail: string; agencyName: string };

export async function submitAgency(raw: unknown): Promise<FormResult<Submitted>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to add your agency." };
  if (typeof raw === "object" && raw !== null && "website" in raw && raw.website) {
    return { ok: true, data: { kind: "review", workEmail: "", agencyName: "" } };
  }

  const parsed = submitAgencySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  }
  const input = parsed.data;

  const ip = await clientIp();
  if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    return { ok: false, error: "The security check didn't pass. Please try it again." };
  }
  if (!(await underRateLimit(ip, input.workEmail))) {
    return { ok: false, error: "Too many attempts. Please try again in an hour." };
  }

  const host = hostFrom(input.siteUrl);
  if (!host)
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { siteUrl: "Use a full link starting with https://" },
    };

  // Read-only checks across all statuses (drafts included), so the service role.
  const admin = createAdminClient();
  const [taxonomy, existing] = await Promise.all([
    Promise.all([
      admin.from("services").select("id, slug").in("slug", input.services),
      admin.from("industries").select("id, slug").in("slug", input.industries),
      admin.from("locations").select("id, slug").in("slug", input.locations),
    ]),
    admin
      .from("agencies")
      .select("name, status, website")
      .ilike("website", `%${host.replace(/[%_]/g, "")}%`)
      .limit(20),
  ]);
  const [services, industries, locations] = taxonomy;
  if (services.error || industries.error || locations.error || existing.error) {
    return { ok: false, error: "Something went wrong on our side. Please try again in a minute." };
  }
  if (
    services.data.length !== input.services.length ||
    industries.data.length !== input.industries.length ||
    locations.data.length !== input.locations.length
  ) {
    return { ok: false, error: "Some options no longer exist. Reload the page." };
  }
  // ilike narrows it down; compare hosts exactly so notacme.com doesn't block acme.com.
  const sameSite = existing.data.filter((a) => a.website && hostFrom(a.website) === host);
  const match = sameSite.find((a) => a.status === "published");
  if (match) {
    return {
      ok: false,
      error: `${match.name} is already listed with this website. Search for it above and claim it instead.`,
    };
  }
  if (sameSite.length > 0) {
    return {
      ok: false,
      error: "An agency with this website has already been submitted and is waiting for review.",
    };
  }

  // The user's own client: RLS + column grants only allow a draft with no owner or flags.
  const supabase = await createClient();
  const id = randomUUID();
  const base = slugify(input.name);
  const row = {
    id,
    name: input.name,
    website: input.siteUrl,
    description: input.description,
    min_budget_usd: input.minBudget === "" ? null : Number(input.minBudget),
    submitted_by: user.id,
  };
  let { error } = await supabase.from("agencies").insert({ ...row, slug: base });
  if (error?.code === "23505") {
    ({ error } = await supabase
      .from("agencies")
      .insert({ ...row, slug: `${base}-${id.slice(0, 6)}` }));
  }
  if (error) {
    // 42501: the RLS cap of 3 open submissions per account.
    if (error.code === "42501") {
      return {
        ok: false,
        error: "You have 3 agencies waiting for review. We'll email you when they're decided.",
      };
    }
    console.error("agency submission insert failed", { code: error.code });
    return { ok: false, error: "Something went wrong on our side. Please try again in a minute." };
  }

  const links = await Promise.all([
    supabase.from("agency_services").insert(
      services.data.map((s) => ({
        agency_id: id,
        service_id: s.id,
        is_primary: s.slug === input.services[0],
      })),
    ),
    supabase.from("agency_industries").insert(
      industries.data.map((i) => ({
        agency_id: id,
        industry_id: i.id,
        is_primary: i.slug === input.industries[0],
      })),
    ),
    locations.data.length
      ? supabase
          .from("agency_locations")
          .insert(locations.data.map((l) => ({ agency_id: id, location_id: l.id })))
      : { error: null },
  ]);
  const { data: claim, error: claimError } = links.some((r) => r.error)
    ? { data: null, error: true }
    : await supabase
        .from("claims")
        .insert({ agency_id: id, user_id: user.id, work_email: input.workEmail })
        .select("id")
        .single();
  if (claimError || !claim) {
    // Don't leave a half-saved draft behind (the submitter can't delete it themselves).
    await admin.from("agencies").delete().eq("id", id).is("owner_id", null);
    console.error("agency submission links failed", { agencyId: id });
    return { ok: false, error: "Something went wrong on our side. Please try again in a minute." };
  }

  const mail = getMailer();
  const domainMatches = emailMatchesWebsite(input.workEmail, input.siteUrl);
  let kind: Submitted["kind"] = "review";
  if (mail && domainMatches) {
    const url = absoluteUrl(
      `/claim/verify?token=${encodeURIComponent(createClaimToken(claim.id))}`,
    );
    const { error: sendError } = await mail.resend.emails.send({
      from: mail.from,
      to: input.workEmail,
      subject: oneLine(`Confirm you manage ${input.name}`),
      react: <ClaimVerificationEmail agencyName={input.name} url={url} />,
    });
    if (sendError) console.error("submission verification email failed", { claimId: claim.id });
    else kind = "verify";
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (mail && adminEmail) {
    after(() =>
      mail.resend.emails
        .send({
          from: mail.from,
          to: adminEmail,
          subject: oneLine(`New agency submitted: ${input.name}`),
          react: (
            <AdminSubmissionEmail
              agencyName={input.name}
              website={input.siteUrl}
              workEmail={input.workEmail}
              accountEmail={user.email ?? null}
              domainMatches={domainMatches}
              reviewUrl={absoluteUrl("/admin/submissions")}
            />
          ),
        })
        .then(
          ({ error: e }) => e && console.error("admin submission email failed", { agencyId: id }),
        ),
    );
  }
  return { ok: true, data: { kind, workEmail: input.workEmail, agencyName: input.name } };
}
