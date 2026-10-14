import { redirect } from "next/navigation";

import { getOwnedAgency, requireUser } from "@/lib/auth";
import { checkoutTarget } from "@/lib/billing/checkout";
import { createClient } from "@/lib/supabase/server";

// GET /dashboard/billing/checkout?period=monthly|yearly: "Get Pro" on /pricing. Signed out →
// sign in and come back here. No agency → find or add one first (List your agency). One agency
// → its Creem checkout for that period, created server-side. Several → ?agency=<slug>, else
// the dashboard to pick one (each Billing page has its own Get Pro). Linked with a plain <a>, so
// it's never prefetched.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const period = params.get("period") === "yearly" ? "yearly" : "monthly";
  const wanted = params.get("agency")?.toLowerCase() ?? "";

  const user = await requireUser(`/dashboard/billing/checkout?period=${period}`);
  const supabase = await createClient();
  const { data } = await supabase.from("agencies").select("id, slug").eq("owner_id", user.id);
  const mine = data ?? [];
  if (mine.length === 0) redirect("/list-your-agency#claim");
  const pick = mine.find((a) => a.slug === wanted) ?? (mine.length === 1 ? mine[0] : null);
  if (!pick) redirect("/dashboard");

  const o = await getOwnedAgency(pick.id);
  if (!o) redirect("/dashboard");
  redirect(
    await checkoutTarget(o, user.id, user.email ?? null, period === "yearly" ? "year" : "month"),
  );
}
