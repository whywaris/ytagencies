import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Billing" };

// /dashboard/billing: where "Get Pro" on the pricing page and Creem's success_url land. Sends the
// owner to their agency's Billing page (keeping status/interval), or to the listings list when
// they have several, or to List your agency when they have none.
export default async function BillingRedirect({ searchParams }: PageProps<"/dashboard/billing">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = one(sp.status) === "success" ? "success" : null;
  const interval = ["month", "year"].includes(one(sp.interval) ?? "") ? one(sp.interval) : null;
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (interval) query.set("interval", interval!);
  const q = query.size ? `?${query}` : "";

  const user = await requireUser(`/dashboard/billing${q}`);
  const supabase = await createClient();
  const { data } = await supabase.from("agencies").select("id, slug").eq("owner_id", user.id);
  const owned = data ?? [];
  const wanted = one(sp.agency)?.toLowerCase();
  // ?agency= by id (older Creem return links) or slug.
  const match = owned.find((a) => a.id === wanted || a.slug === wanted);
  if (match) redirect(`/dashboard/${match.slug}/billing${q}`);
  if (owned.length === 1) redirect(`/dashboard/${owned[0].slug}/billing${q}`);
  redirect(owned.length ? "/dashboard" : "/list-your-agency");
}
