import "server-only";
import { notFound, redirect } from "next/navigation";

import { safeNext } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

// Server-side auth checks. Pages and server actions call these even though the proxy gates
// /admin: the proxy is an optimistic check, these are the real ones (SECURITY.md).

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The signed-in user if their profile role is admin, else null. Checked in every admin page and action. */
export async function getAdminUser() {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "admin" ? user : null;
}

/** For admin pages: signed-out → login, signed-in non-admin → 404 (admin isn't advertised). */
export async function requireAdmin(next = "/admin") {
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(safeNext(next) ?? "/admin")}`);
  const admin = await getAdminUser();
  if (!admin) notFound();
  return admin;
}
