import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardTabs } from "@/components/dashboard/tabs";
import { getOwnedAgency } from "@/lib/auth";
import { getEntitlements } from "@/lib/data/entitlements";

export default async function AgencyDashboardLayout({
  children,
  params,
}: LayoutProps<"/dashboard/[agencyId]">) {
  const { agencyId } = await params;
  // Someone else's agency id is a 404, not a "forbidden" that confirms it exists.
  const owned = await getOwnedAgency(agencyId);
  if (!owned) notFound();
  const { agency, supabase } = owned;
  const [e, past] = await Promise.all([
    getEntitlements(agency.id),
    supabase
      .from("agency_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id),
  ]);
  const lapsed = (past.count ?? 0) > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">{agency.name}</h1>
        {agency.status === "published" ? (
          <Link href={`/agency/${agency.slug}`} className="self-start text-accent hover:underline">
            View public profile
          </Link>
        ) : (
          <p className="text-small">This listing isn&apos;t public yet ({agency.status}).</p>
        )}
      </header>
      {!e.managed && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-lg border border-line bg-(--amber-soft) px-4 py-3 text-[15px] text-text"
        >
          <p>
            {lapsed
              ? "Your Pro plan has ended, so your listing is unmanaged: editing is locked and businesses can't contact you. Your details are kept and your profile stays public."
              : "Your listing is unmanaged: editing is locked and businesses can't contact you. Pro lets you manage it and receive inquiries."}
          </p>
          <Link
            href={`/dashboard/${agency.id}/billing`}
            className="self-start font-semibold text-accent hover:underline"
          >
            {lapsed ? "Renew Pro" : "Get Pro"}
          </Link>
        </div>
      )}
      <DashboardTabs agencyId={agency.id} />
      {children}
    </div>
  );
}
