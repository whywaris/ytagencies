import { Overview } from "@/components/dashboard/overview";
import { dashboardContext } from "@/lib/data/dashboard";

export const metadata = { title: "Overview" };

export default async function OverviewPage({ params }: PageProps<"/dashboard/[slug]">) {
  return <Overview ctx={await dashboardContext((await params).slug)} />;
}
