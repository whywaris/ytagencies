import { DashboardNotFound } from "@/components/dashboard/not-found-panel";

// An unknown page under an agency you own (/dashboard/<slug>/[...rest]): inside the sidebar layout.
export default function NotFound() {
  return <DashboardNotFound />;
}
