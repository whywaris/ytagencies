import { AgencyDashboardShell } from "@/components/dashboard/shell";
import { dashboardContext } from "@/lib/data/dashboard";

export default async function AgencyDashboardLayout({
  children,
  params,
}: LayoutProps<"/dashboard/[slug]">) {
  // The slug finds the agency; ownership is still checked (404 otherwise).
  const ctx = await dashboardContext((await params).slug);
  return <AgencyDashboardShell ctx={ctx}>{children}</AgencyDashboardShell>;
}
