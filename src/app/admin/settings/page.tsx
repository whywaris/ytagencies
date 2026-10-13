import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { paymentsEnabled } from "@/lib/billing";
import { cn } from "@/lib/utils";

export const metadata = { title: "Settings" };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 py-8 md:grid-cols-[240px_1fr] md:gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-admin-section">{title}</h2>
        <p className="text-admin-meta">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** ADMIN_V2_SPEC §5.10: admin profile and payments status (read-only). */
export default async function AdminSettingsPage() {
  const admin = await requireAdmin("/admin/settings");
  const payments = paymentsEnabled();

  return (
    <div className="flex max-w-[880px] flex-col">
      <h1 className="text-admin-title">Settings</h1>

      <div className="flex flex-col divide-y divide-line">
        <Section title="Your account" description="The admin you're signed in as.">
          <dl className="grid grid-cols-[120px_1fr] gap-y-3">
            <dt className="text-text-2">Email</dt>
            <dd className="min-w-0 truncate">{admin.email}</dd>
            <dt className="text-text-2">Role</dt>
            <dd>Admin</dd>
          </dl>
        </Section>

        <Section
          title="Payments"
          description="Read-only. Set by PAYMENTS_ENABLED in the Vercel environment."
        >
          <p className="flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", payments ? "bg-success" : "bg-text-2")}
            />
            {payments ? "On" : "Off"}
          </p>
          <p className="mt-1 text-text-2">
            {payments
              ? "Agencies can pay for plans."
              : "No one is charged. Plans are granted by hand on "}
            {!payments && (
              <Link href="/admin/plans" className="text-accent hover:underline">
                Plans
              </Link>
            )}
            {!payments && "."}
          </p>
        </Section>
      </div>
    </div>
  );
}
