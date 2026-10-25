"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";

import { AdminSubmissionEmail } from "@/emails/admin-submission";
import { ClaimVerificationEmail } from "@/emails/claim-verification";
import { getUser } from "@/lib/auth";
import { createClaimToken, emailMatchesWebsite } from "@/lib/claims";
import { profileViews } from "@/lib/data/agency-stats";
import { getMailer, oneLine } from "@/lib/email";
import { clientIp, underRateLimit } from "@/lib/forms/guard";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { FormResult } from "@/lib/validation/lead";
import { detailsColumns, industryColumns, serviceColumns } from "@/lib/profile-details-db";
import { agencySearchSchema, submitAgencySchema } from "@/lib/validation/listing";

// /list-your-agency. SECURITY.md: ownership is never auto-granted. A submission is a draft with no
// owner; the submitter becomes owner only via the claims flow (domain-matched email) or an admin.

export type FoundAgency = {
  slug: string;
  name: string;
  website: string | null;
  /** Main service name, for telling similar names apart. */
  service: string | null;
  /** Who manages it: nobody yet, the signed-in user, or someone else. */
  ownership: "none" | "mine" | "other";
  /** Profile views in the last 30 days, only when there are at least 5 (else null). */
  views: number | null;
};

/** Below this, "n businesses viewed this profile" isn't worth saying. */
const MIN_VIEWS_SHOWN = 5;

/** "https://www.acme.com/about" or "acme.com" → "acme.com"; null if it doesn't look like a domain. */
function hostFrom(input: string) {
  try {
    const host = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`).hostname;
    return host.includes(".") ? host.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/**
 * Published agencies whose name or website matches. Owner ids aren't public, so this reads with
 * the service role (published rows only) and returns just who manages it relative to the caller.
 */
export async function searchAgencies(raw: string): Promise<FoundAgency[]> {
  const parsed = agencySearchSchema.safeParse(raw);
  if (!parsed.success) return [];
  // Only characters that can't break PostgREST's or() syntax or act as LIKE wildcards.
  const term = parsed.data.replace(/[^\p{L}\p{N} .-]/gu, " ").trim();
  if (term.length < 2) return [];
  const host = hostFrom(parsed.data)?.replace(/[^a-z0-9.-]/g, "");
  const filters = [`name.ilike.*${term}*`];
  if (host) filters.push(`website.ilike.*${host}*`);

  const [{ data, error }, user] = await Promise.all([
    createAdminClient()
      .from("agencies")
      .select("id, slug, name, website, owner_id, agency_services(is_primary, services(name))")
      .eq("status", "published")
      .or(filters.join(","))
      .order("name")
      .limit(8),
    getUser(),
  ]);
  if (error) {
    console.error("agency search failed");
    return [];
  }
  const views = await profileViews(data.filter((a) => !a.owner_id).map((a) => a.id));
  return data.map((a) => {
    const n = views.get(a.id) ?? 0;
    const main = a.agency_services.find((s) => s.is_primary) ?? a.agency_services[0];
    const mine = !!user && a.owner_id === user.id;
    return {
      slug: a.slug,
      name: a.name,
      website: a.website,
      service: main?.services?.name ?? null,
      ownership: mine ? "mine" : a.owner_id ? "other" : "none",
      views: n >= MIN_VIEWS_SHOWN ? n : null,
    };
  });
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

type Submitted = {
  kind: "verify" | "review";
  workEmail: string;
  agencyName: string;
  /** The new draft, for "Subscribe now" (startSubmissionCheckout). */
  agencyId: string;
};

export async function submitAgency(raw: unknown): Promise<FormResult<Submitted>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to add your agency." };
  if (typeof raw === "object" && raw !== null && "website" in raw && raw.website) {
    return { ok: true, data: { kind: "review", workEmail: "", agencyName: "", agencyId: "" } };
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
      admin
        .from("locations")
        .select("id, slug, type, parent_id")
        .in("slug", [
          ...input.locations,
          input.hqCountry,
          ...(input.hqCity && input.hqCity !== "other" ? [input.hqCity] : []),
        ]),
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
    input.locations.some((l) => !locations.data.some((d) => d.slug === l))
  ) {
    return { ok: false, error: "Some options no longer exist. Reload the page." };
  }
  // HQ: the city if it's one of ours (and in the chosen country), else the country. A city we
  // don't list goes in hq_other for an admin to map.
  const country = locations.data.find((l) => l.slug === input.hqCountry && l.type === "country");
  const city =
    input.hqCity && input.hqCity !== "other"
      ? locations.data.find((l) => l.slug === input.hqCity && l.parent_id === country?.id)
      : null;
  if (!country || (input.hqCity && input.hqCity !== "other" && !city)) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { hqCountry: "Choose your country, then a city in it." },
    };
  }
  const hqId = (city ?? country).id;
  // Listed in the HQ place and the other places they serve, once each.
  const servedIds = [
    ...new Set([
      hqId,
      ...locations.data.filter((l) => input.locations.includes(l.slug)).map((l) => l.id),
    ]),
  ];
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
    min_budget_usd: Number(input.minBudget),
    pricing_model: input.pricingModel || null,
    min_contract: input.minContract || null,
    ad_spend: input.adSpend || null,
    setup_fee_usd: input.setupFee === "" ? null : Number(input.setupFee),
    ...detailsColumns(input),
    hq_location_id: hqId,
    hq_other: input.hqCity === "other" ? input.hqCityOther : null,
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
        ...serviceColumns(input, s.slug, input.pricingModel || null),
      })),
    ),
    supabase.from("agency_industries").insert(
      industries.data.map((i) => ({
        agency_id: id,
        industry_id: i.id,
        is_primary: i.slug === input.industries[0],
        ...industryColumns(input, i.slug),
      })),
    ),
    supabase
      .from("agency_locations")
      .insert(servedIds.map((location_id) => ({ agency_id: id, location_id }))),
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
    const { error: sendError } = await mail.send({
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
      mail
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
  return {
    ok: true,
    data: { kind, workEmail: input.workEmail, agencyName: input.name, agencyId: id },
  };
}
