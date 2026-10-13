import Link from "next/link";

import { btnPrimary } from "@/components/dashboard/ui";

/** The dashboard's 404 (not the public browse page): same message for an unknown page and for an
 * agency you don't own, so it never confirms someone else's listing exists. */
export function DashboardNotFound() {
  return (
    <section className="flex max-w-reading flex-col items-start gap-3 py-10">
      <h1 className="text-[26px] font-[650] tracking-[-0.03em]">
        This page doesn&apos;t exist in your dashboard
      </h1>
      <p className="text-text-2">The link may be old, or the listing isn&apos;t one you manage.</p>
      <Link href="/dashboard" className={btnPrimary}>
        Back to dashboard
      </Link>
    </section>
  );
}
