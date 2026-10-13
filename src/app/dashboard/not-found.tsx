import { DashboardNotFound } from "@/components/dashboard/not-found-panel";

// Unknown slug, or an agency the signed-in user doesn't own (dashboardContext 404s): inside the
// dashboard header, without a sidebar.
export default function NotFound() {
  return <DashboardNotFound />;
}
