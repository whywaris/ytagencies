import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/types";

// Audit log (ADMIN_V2_SPEC §5, §7): every admin mutation writes one row to admin_actions.
// Never put personal data in `details` (lead names, emails, messages): ids and field names only.

export type AdminLog = (
  action: string,
  entityType: string,
  entityId: string | number | null,
  details?: { [key: string]: Json | undefined },
) => Promise<void>;

/** A logger bound to one admin (null for system jobs). Failures are reported, never undo the action. */
export function adminLogger(db: SupabaseClient<Database>, adminId: string | null): AdminLog {
  return async (action, entityType, entityId, details = {}) => {
    const { error } = await db.from("admin_actions").insert({
      admin_id: adminId,
      action,
      entity_type: entityType,
      entity_id: entityId === null ? null : String(entityId),
      details,
    });
    if (error)
      console.error("admin_actions insert failed", { action, entityType, code: error.code });
  };
}
