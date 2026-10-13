"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { AdminClaimEmail } from "@/emails/admin-claim";
import { ClaimVerificationEmail } from "@/emails/claim-verification";
import { getUser } from "@/lib/auth";
import { getMailer, oneLine } from "@/lib/email";
import { approveClaim, createClaimToken, emailMatchesWebsite, readClaimToken } from "@/lib/claims";
import { clientIp, underRateLimit, verifyTurnstile } from "@/lib/forms/guard";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ContactAdminEmail } from "@/emails/contact";
import { ACCESS_TOPIC } from "@/lib/contact-topics";
import { accessRequestSchema, claimProofSchema, claimSchema } from "@/lib/validation/auth";
import type { FormResult } from "@/lib/validation/lead";

// SECURITY.md: ownership is never auto-granted. It needs a confirmed email on the agency's own
// domain, or an admin approving the claim by hand.

type ClaimStarted = { kind: "verify" | "review"; workEmail: string };

const GENERIC = "Something went wrong on our side. Please try again in a minute.";
const fieldErrors = (issues: { path: PropertyKey[]; message: string }[]) =>
  Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));

/** Signed in, honeypot, Turnstile and rate limit: the checks every claim form shares. */
async function guard(raw: unknown, key: string, token: string) {
  const user = await getUser();
  if (!user) return { error: "Sign in first." } as const;
  if (typeof raw === "object" && raw !== null && "website" in raw && raw.website)
    return { bot: true } as const;
  const ip = await clientIp();
  if (!(await verifyTurnstile(token, ip)))
    return { error: "The security check didn't pass. Please try it again." } as const;
  if (!(await underRateLimit(ip, key)))
    return { error: "Too many attempts. Please try again in an hour." } as const;
  return { user } as const;
}

export async function startClaim(raw: unknown): Promise<FormResult<ClaimStarted>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to claim this listing." };
  if (typeof raw === "object" && raw !== null && "website" in raw && raw.website) {
    return { ok: true, data: { kind: "review", workEmail: "" } };
  }

  const parsed = claimSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  }
  const { agencySlug, workEmail, turnstileToken } = parsed.data;

  const ip = await clientIp();
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "The security check didn't pass. Please try it again." };
  }
  if (!(await underRateLimit(ip, workEmail))) {
    return { ok: false, error: "Too many attempts. Please try again in an hour." };
  }

  const supabase = await createClient();
  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name, website, is_claimed")
    .eq("slug", agencySlug)
    .eq("status", "published")
    .maybeSingle();
  if (!agency) return { ok: false, error: "This agency is no longer listed." };
  if (agency.is_claimed) {
    return {
      ok: false,
      error: "This listing has already been claimed. Contact us if that's wrong.",
    };
  }

  // User's own client: RLS only allows a pending claim for themselves.
  const { data: claim, error } = await supabase
    .from("claims")
    .insert({ agency_id: agency.id, user_id: user.id, work_email: workEmail })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "You already have an open claim for this listing. Check your email or wait for our review.",
      };
    }
    console.error("claim insert failed");
    return { ok: false, error: "Something went wrong on our side. Please try again in a minute." };
  }

  const mail = getMailer();
  if (emailMatchesWebsite(workEmail, agency.website)) {
    if (!mail) {
      console.warn("Email not configured; claim left for admin review", { claimId: claim.id });
      return { ok: true, data: { kind: "review", workEmail } };
    }
    const url = absoluteUrl(
      `/claim/verify?token=${encodeURIComponent(createClaimToken(claim.id))}`,
    );
    const { error: sendError } = await mail.send({
      from: mail.from,
      to: workEmail,
      subject: oneLine(`Confirm you manage ${agency.name}`),
      react: <ClaimVerificationEmail agencyName={agency.name} url={url} />,
    });
    if (sendError) {
      console.error("claim verification email failed", { claimId: claim.id });
      return { ok: true, data: { kind: "review", workEmail } };
    }
    return { ok: true, data: { kind: "verify", workEmail } };
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (mail && adminEmail) {
    after(() =>
      mail
        .send({
          from: mail.from,
          to: adminEmail,
          subject: oneLine(`Claim to review: ${agency.name}`),
          react: (
            <AdminClaimEmail
              claimId={claim.id}
              agencyName={agency.name}
              website={agency.website}
              workEmail={workEmail}
              accountEmail={user.email ?? null}
            />
          ),
        })
        .then(
          ({ error: e }) => e && console.error("admin claim email failed", { claimId: claim.id }),
        ),
    );
  }
  return { ok: true, data: { kind: "review", workEmail } };
}

/** Approves a domain-verified claim. Requires the claimant's session, not just the link. */
export async function confirmClaim(token: string): Promise<FormResult<{ next: string }>> {
  const user = await getUser();
  if (!user)
    return { ok: false, error: "Sign in with the account you used to claim this listing." };

  const claimId = readClaimToken(token);
  if (!claimId)
    return { ok: false, error: "This link is invalid or has expired. Start the claim again." };

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("claims")
    .select(
      "id, user_id, agency_id, status, work_email, agencies(slug, website, is_claimed, status, submitted_by)",
    )
    .eq("id", claimId)
    .maybeSingle();
  const agency = claim?.agencies;
  if (!claim || !agency || claim.status !== "pending") {
    return { ok: false, error: "This claim is no longer open." };
  }
  if (claim.user_id !== user.id) {
    return {
      ok: false,
      error: "You're signed in with a different account from the one that made this claim.",
    };
  }
  // Re-check: the website could have changed since the email was sent.
  // Published listings, or the draft this user submitted via /list-your-agency (stays a draft
  // until an admin publishes it).
  const claimable =
    agency.status === "published" || (agency.status === "draft" && agency.submitted_by === user.id);
  if (!claimable || agency.is_claimed || !emailMatchesWebsite(claim.work_email, agency.website)) {
    return { ok: false, error: "This listing can't be claimed this way any more. Contact us." };
  }

  const approved = await approveClaim({ id: claim.id, agencyId: claim.agency_id, userId: user.id });
  if (!approved) return { ok: false, error: "This listing has just been claimed." };

  revalidatePath(`/agency/${agency.slug}`); // drops the "Claim this listing" link
  // A published listing goes on to step 3 (choose Pro); a submission waits for review.
  const next =
    agency.status === "published" ? `/claim/${agency.slug}` : `/dashboard/${agency.slug}`;
  return { ok: true, data: { next } };
}

/**
 * No email on the agency's domain: a pending claim with proof (role, LinkedIn, note) that an admin
 * approves or rejects in Admin → Claims. Recorded against the signed-in account's email.
 */
export async function submitClaimProof(raw: unknown): Promise<FormResult> {
  const parsed = claimProofSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error.issues),
    };
  const input = parsed.data;
  const g = await guard(raw, input.linkedinUrl, input.turnstileToken);
  if ("bot" in g) return { ok: true, data: undefined };
  if ("error" in g) return { ok: false, error: g.error! };
  const { user } = g;
  if (!user.email) return { ok: false, error: GENERIC };

  const supabase = await createClient();
  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name, website, is_claimed")
    .eq("slug", input.agencySlug)
    .eq("status", "published")
    .maybeSingle();
  if (!agency) return { ok: false, error: "This agency is no longer listed." };
  if (agency.is_claimed) return { ok: false, error: "Someone already manages this listing." };

  const { data: claim, error } = await supabase
    .from("claims")
    .insert({
      agency_id: agency.id,
      user_id: user.id,
      work_email: user.email,
      role: input.role,
      linkedin_url: input.linkedinUrl,
      note: input.note || null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return {
        ok: false,
        error: "You already have an open claim for this listing. We'll email you.",
      };
    console.error("claim proof insert failed", { code: error.code });
    return { ok: false, error: GENERIC };
  }

  const mail = getMailer();
  const adminEmail = process.env.ADMIN_EMAIL;
  if (mail && adminEmail) {
    after(() =>
      mail
        .send({
          from: mail.from,
          to: adminEmail,
          subject: oneLine(`Claim to review: ${agency.name}`),
          react: (
            <AdminClaimEmail
              claimId={claim.id}
              agencyName={agency.name}
              website={agency.website}
              workEmail={user.email!}
              accountEmail={user.email ?? null}
            />
          ),
        })
        .then(
          ({ error: e }) => e && console.error("admin claim email failed", { claimId: claim.id }),
        ),
    );
  }
  revalidatePath(`/claim/${input.agencySlug}`);
  return { ok: true, data: undefined };
}

/**
 * Someone else manages the listing: an "Access request" in Admin → Inbox, emailed to help@. The
 * admin contacts the current manager and the agency and decides; nothing changes automatically.
 */
export async function requestAccess(raw: unknown): Promise<FormResult> {
  const parsed = accessRequestSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error.issues),
    };
  const input = parsed.data;
  const g = await guard(raw, input.agencySlug, input.turnstileToken);
  if ("bot" in g) return { ok: true, data: undefined };
  if ("error" in g) return { ok: false, error: g.error! };
  const { user } = g;
  if (!user.email) return { ok: false, error: GENERIC };

  const admin = createAdminClient();
  const { data: agency } = await admin
    .from("agencies")
    .select("name, owner_id")
    .eq("slug", input.agencySlug)
    .eq("status", "published")
    .maybeSingle();
  if (!agency) return { ok: false, error: "This agency is no longer listed." };
  if (agency.owner_id === user.id) return { ok: false, error: "You already manage this listing." };

  const agencyUrl = absoluteUrl(`/agency/${input.agencySlug}`);
  const message = `Agency: ${agency.name}\nRole: ${input.role}\n\n${input.why}`;
  const { data, error } = await admin
    .from("contact_messages")
    .insert({
      topic: ACCESS_TOPIC.id,
      name: user.email,
      email: user.email,
      message,
      agency_url: agencyUrl,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("access request insert failed", { code: error?.code });
    return { ok: false, error: GENERIC };
  }
  const mail = getMailer();
  if (mail) {
    after(() =>
      mail
        .send({
          from: mail.from,
          to: ACCESS_TOPIC.inbox,
          replyTo: user.email!,
          subject: oneLine(`${ACCESS_TOPIC.label}: ${agency.name}`),
          react: (
            <ContactAdminEmail
              topic={ACCESS_TOPIC.label}
              name={user.email!}
              email={user.email!}
              message={message}
              agencyUrl={agencyUrl}
              inboxUrl={absoluteUrl(`/admin/inbox/${data.id}`)}
            />
          ),
        })
        .then(({ error: e }) => e && console.error("access request email failed", { id: data.id })),
    );
  }
  return { ok: true, data: undefined };
}
