import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardTabs } from "@/components/dashboard/tabs";
import { getOwnedAgency } from "@/lib/auth";

export default async function AgencyDashboardLayout({
  children,
  params,
}: LayoutProps<"/dashboard/[agencyId]">) {
  const { agencyId } = await params;
  // Someone else's agency id is a 404, not a "forbidden" that confirms it exists.
  const owned = await getOwnedAgency(agencyId);
  if (!owned) notFound();
  const { agency } = owned;

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
      <DashboardTabs agencyId={agency.id} />
      {children}
    </div>
  );
}
