import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

// Claim verification links: "<claimId>.<expiresAtSeconds>.<hmac>". Stateless, so no token table.
// The link alone isn't enough: confirming also requires being signed in as the claimant.

const TTL_SECONDS = 24 * 60 * 60;

function secret() {
  const s = process.env.CLAIM_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error("CLAIM_TOKEN_SECRET must be at least 32 characters");
  return s;
}

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");

export function createClaimToken(claimId: string, now = Date.now()) {
  const payload = `${claimId}.${Math.floor(now / 1000) + TTL_SECONDS}`;
  return `${payload}.${sign(payload)}`;
}

/** The claim id if the token is authentic and unexpired, else null. */
export function readClaimToken(token: string, now = Date.now()) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [claimId, expires, mac] = parts;
  const expected = Buffer.from(sign(`${claimId}.${expires}`));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (Number(expires) * 1000 < now) return null;
  return claimId;
}

/**
 * True if the work email is on the agency's own website domain (or a subdomain of it):
 * ana@acmemedia.com and ana@mail.acmemedia.com both match https://www.acmemedia.com.
 */
export function emailMatchesWebsite(email: string, website: string | null) {
  if (!website) return false;
  let host: string;
  try {
    host = new URL(website).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || !host.includes(".")) return false;
  return domain === host || domain.endsWith(`.${host}`);
}

/**
 * Grants ownership for a pending claim (service role). Callers do the checks first: the claimant's
 * session + domain for email confirmation, or the admin role for manual review.
 * Returns false if the listing was claimed in the meantime.
 */
export async function approveClaim(claim: { id: string; agencyId: string; userId: string }) {
  const admin = createAdminClient();
  // Conditional update so two approvals can't both win.
  const { data: updated, error } = await admin
    .from("agencies")
    .update({ owner_id: claim.userId, is_claimed: true, updated_at: new Date().toISOString() })
    .eq("id", claim.agencyId)
    .eq("is_claimed", false)
    .select("id");
  if (error || !updated?.length) return false;

  await Promise.all([
    admin.from("claims").update({ status: "approved" }).eq("id", claim.id),
    admin
      .from("claims")
      .update({ status: "rejected" })
      .eq("agency_id", claim.agencyId)
      .eq("status", "pending")
      .neq("id", claim.id),
    admin.from("profiles").update({ role: "agency" }).eq("id", claim.userId).eq("role", "user"),
  ]);
  return true;
}
