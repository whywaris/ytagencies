import { notFound } from "next/navigation";

// Any /dashboard/<slug>/<unknown> path: the layout has already checked ownership, so this shows the
// dashboard 404 inside the sidebar layout instead of the public one.
export default function UnknownDashboardPage() {
  notFound();
}
