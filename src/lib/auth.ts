import "server-only";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Server-side auth checks. Pages and server actions call these even though the proxy gates
// /dashboard and /admin: the proxy is an optimistic check, these are the real ones (SECURITY.md).

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Only same-site relative paths, so ?next= can't send people to another site. */
export function safeNext(next: string | null | undefined, fallback = "/dashboard") {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : fallback;
}

export async function requireUser(next = "/dashboard") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  return user;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The agency if the signed-in user owns it, else null. Uses the user's client, so RLS applies
 * on top of the explicit owner_id check.
 */
export async function getOwnedAgency(agencyId: string) {
  if (!UUID.test(agencyId)) return null;
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agencies")
    .select("id, slug, name, description, min_budget_usd, pricing_model, logo_path, status")
    .eq("id", agencyId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return { user, agency: data, supabase };
}

/** The signed-in user if their profile role is admin, else null. Checked in every admin page and action. */
export async function getAdminUser() {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "admin" ? user : null;
}

/** For admin pages: signed-out → login, signed-in non-admin → 404 (doesn't reveal the area). */
export async function requireAdmin(next = "/admin") {
  await requireUser(next);
  const admin = await getAdminUser();
  if (!admin) notFound();
  return admin;
}
