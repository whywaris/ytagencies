import "server-only";
import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";

// Founding programme settings (ADMIN_V2_SPEC §5.10). Service role: the pricing page reads this
// and anon can't read app_settings.

export type FoundingProgram = {
  open: boolean;
  maxSpots: number;
  freeMonths: number;
  /** Agencies that have ever been granted Founding (the badge is for good, so spots stay used). */
  used: number;
  updatedAt: string;
};

export const getFoundingProgram = cache(async (): Promise<FoundingProgram> => {
  const db = createAdminClient();
  const [settings, founding] = await Promise.all([
    db.from("app_settings").select("*").single(),
    // max_spots is capped at 1,000 in the schema, so one page of rows covers it
    db.from("agency_subscriptions").select("agency_id").eq("plan_id", "founding").limit(1000),
  ]);
  if (settings.error || founding.error) throw new Error("Couldn't load settings");
  return {
    open: settings.data.founding_open,
    maxSpots: settings.data.founding_max_spots,
    freeMonths: settings.data.founding_free_months,
    used: new Set(founding.data.map((r) => r.agency_id)).size,
    updatedAt: settings.data.updated_at,
  };
});

/** Open and not full: new agencies can still join as Founding. */
export const foundingAvailable = (p: FoundingProgram) => p.open && p.used < p.maxSpots;
