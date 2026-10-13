import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Billing" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const { data } = await supabase.from("agencies").select("id").eq("owner_id", user.id);
  const ids = data?.map((a) => a.id) ?? [];
  const wanted = one(sp.agency);
  if (wanted && UUID.test(wanted) && ids.includes(wanted.toLowerCase()))
    redirect(`/dashboard/${wanted.toLowerCase()}/billing${q}`);
  if (ids.length === 1) redirect(`/dashboard/${ids[0]}/billing${q}`);
  redirect(ids.length ? "/dashboard" : "/list-your-agency");
}
