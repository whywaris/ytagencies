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
import { claimSchema } from "@/lib/validation/auth";
import type { FormResult } from "@/lib/validation/lead";

// SECURITY.md: ownership is never auto-granted. It needs a confirmed email on the agency's own
// domain, or an admin approving the claim by hand.

type ClaimStarted = { kind: "verify" | "review"; workEmail: string };

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
    const url = absoluteUrl(`/claim/verify?token=${encodeURIComponent(createClaimToken(claim.id))}`);
    const { error: sendError } = await mail.resend.emails.send({
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
      mail.resend.emails
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
export async function confirmClaim(token: string): Promise<FormResult<{ agencyId: string }>> {
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
      "id, user_id, agency_id, status, work_email, agencies(slug, website, is_claimed, status)",
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
  if (
    agency.status !== "published" ||
    agency.is_claimed ||
    !emailMatchesWebsite(claim.work_email, agency.website)
  ) {
    return { ok: false, error: "This listing can't be claimed this way any more. Contact us." };
  }

  const approved = await approveClaim({ id: claim.id, agencyId: claim.agency_id, userId: user.id });
  if (!approved) return { ok: false, error: "This listing has just been claimed." };

  revalidatePath(`/agency/${agency.slug}`); // drops the "Claim this listing" link
  return { ok: true, data: { agencyId: claim.agency_id } };
}
