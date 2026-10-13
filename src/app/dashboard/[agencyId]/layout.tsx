import Link from "next/link";

import { AgencyLogo } from "@/components/agency-logo";
import { DashboardTabs } from "@/components/dashboard/tabs";
import { btnLight, btnPrimary } from "@/components/dashboard/ui";
import { UpgradeDialog } from "@/components/dashboard/upgrade-dialog";
import { COMPANY } from "@/lib/company";
import { dashboardContext } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

// docs/mockups/agency-dashboard.html: the agency, its plan pill and actions, a section sidebar.
export default async function AgencyDashboardLayout({
  children,
  params,
}: LayoutProps<"/dashboard/[agencyId]">) {
  const ctx = await dashboardContext((await params).agencyId);
  const { agency, supabase, e, lapsed, endedAt, pro } = ctx;
  const { count: waiting } = e.managed
    ? await supabase
        .from("lead_routes")
        .select("lead_id", { count: "exact", head: true })
        .eq("agency_id", agency.id)
        .is("contacted_at", null)
    : { count: 0 };

  return (
    <div className="grid gap-6 min-[900px]:grid-cols-[200px_minmax(0,1fr)] min-[900px]:gap-10">
      <div className="min-[900px]:row-span-2">
        <DashboardTabs
          agencyId={agency.id}
          managed={e.managed}
          lapsed={lapsed}
          waiting={waiting ?? 0}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-[22px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <AgencyLogo name={agency.name} logoPath={agency.logo_path} />
            <div className="min-w-0">
              <h1 className="truncate text-[26px] font-[650] tracking-[-0.03em]">{agency.name}</h1>
              <div className="flex flex-wrap items-center gap-2.5 text-[13.5px] text-text-2">
                <span
                  className={cn(
                    "inline-flex h-[22px] items-center rounded-full px-[9px] text-[12px] font-[650]",
                    e.managed
                      ? "bg-(--accent-soft) text-(--accent-on-soft)"
                      : "bg-surface text-text",
                  )}
                >
                  {e.managed ? "Pro" : "Not managed"}
                </span>
                <span className="capitalize">{agency.status}</span>
                {agency.status === "published" && (
                  <Link
                    href={`/agency/${agency.slug}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    View public profile
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {e.managed ? (
              <Link href={`/dashboard/${agency.id}/profile`} className={btnLight}>
                Edit profile
              </Link>
            ) : (
              <UpgradeDialog
                className={btnPrimary}
                label={lapsed ? "Renew Pro" : "Get Pro"}
                agencyId={agency.id}
                agencyUrl={pro.agencyUrl}
                monthly={pro.monthly}
                yearly={pro.yearly}
                saving={pro.saving}
                live={pro.checkout}
                from="billing"
                refundDays={COMPANY.refunds.yearlyFullRefundDays}
              />
            )}
          </div>
        </header>
        {lapsed && (
          <p role="status" className="rounded-2xl bg-(--amber-soft) px-[18px] py-4 text-[15px]">
            <b className="block">
              {endedAt
                ? `Your Pro plan ended on ${new Date(endedAt).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}.`
                : "Your Pro plan has ended."}{" "}
              <Link
                href={`/dashboard/${agency.id}/billing`}
                className="text-accent hover:underline"
              >
                Resubscribe
              </Link>{" "}
              to receive new inquiries.
            </b>
            <span className="text-text-2">
              Your profile stays public with the details you added. Past inquiries stay readable;
              editing is locked until you&apos;re back on Pro.
            </span>
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
