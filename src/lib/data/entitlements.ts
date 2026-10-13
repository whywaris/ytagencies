import "server-only";
import { cache } from "react";

import { entitlementsFor, type Entitlements } from "@/lib/entitlements";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The one way to ask whether a listing is managed (live Pro) and what that allows. Service role: public
 * pages call this too, and anon can't read subscriptions or verifications. Read-only.
 */
export const getEntitlements = cache(async (agencyId: string): Promise<Entitlements> => {
  const db = createAdminClient();
  const [subs, verification] = await Promise.all([
    db
      .from("agency_subscriptions")
      .select("plan_id, status, starts_at, ends_at, cancel_at_period_end, past_due_since")
      .eq("agency_id", agencyId),
    db
      .from("verifications")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("status", "approved")
      .limit(1),
  ]);
  if (subs.error || verification.error) throw new Error("Couldn't load the agency's plan");
  return entitlementsFor({
    subscriptions: subs.data,
    verificationApproved: verification.data.length > 0,
  });
});
