import "server-only";

import { adminLogger } from "@/lib/admin-log";
import { getAdminUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Every admin mutation starts here (SECURITY.md): the role check, then the service-role client
// and an audit logger bound to this admin.

export const NOT_ADMIN = "You need admin access for this.";

export async function adminContext() {
  const admin = await getAdminUser();
  if (!admin) return null;
  const db = createAdminClient();
  return { db, adminId: admin.id, log: adminLogger(db, admin.id) };
}

/** For plain <form action> buttons: no UI for errors, so refuse loudly. */
export async function adminContextOrThrow() {
  const ctx = await adminContext();
  if (!ctx) throw new Error(NOT_ADMIN);
  return ctx;
}
