import Link from "next/link";

import { dashboardContext } from "@/lib/data/dashboard";

export const metadata = { title: "Payment received" };

// Creem's success_url for Get Pro. The plan itself is switched on by the webhook
// (/api/billing/webhook), usually within seconds; until then this says so.
export default async function BillingSuccessPage({
  params,
}: PageProps<"/dashboard/[slug]/billing/success">) {
  const { agency, e } = await dashboardContext((await params).slug);
  return (
    <section className="flex max-w-reading flex-col gap-4" role="status">
      <h1 className="text-h2">{e.managed ? "You're on Pro" : "Payment received"}</h1>
      <p className="text-text-2">
        {e.managed
          ? `Thanks. ${agency.name} is managed now: businesses can contact you from your profile, and inquiries land in your dashboard.`
          : "Thanks. We're switching Pro on for your agency; it usually takes a few seconds. Refresh this page in a moment."}
      </p>
      <div className="flex flex-wrap gap-4">
        <Link href={`/dashboard/${agency.slug}`} className="font-medium text-accent hover:underline">
          Go to your dashboard
        </Link>
        <Link href={`/dashboard/${agency.slug}/billing`} className="text-text-2 hover:underline">
          Billing
        </Link>
      </div>
    </section>
  );
}
