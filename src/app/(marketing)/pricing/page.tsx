import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { PlanColumns } from "@/components/plan-columns";
import { COMPANY } from "@/lib/company";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

export const revalidate = 3600;

// Listings are free; managing one takes Pro (lib/entitlements.ts). Until checkout is available
// (PAYMENTS_ENABLED and the Creem env, lib/billing), Get Pro opens the Request Pro form and Sponsored placements are arranged by email.

export const metadata = buildMetadata({
  title: `Pricing for YouTube agencies | ${BRAND_NAME}`,
  description:
    "Listings are free. Pro lets you manage your listing and receive inquiries from businesses, from $29 a month. Sponsor a directory page from $49.",
  path: "/for-agencies/pricing",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "List your agency", path: "/list-your-agency" },
  { name: "Pricing", path: "/for-agencies/pricing" },
];

export default function PricingPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-12 md:px-6 md:py-20">
        <div className="flex flex-col gap-8">
          <Breadcrumbs items={breadcrumbs} />
          <header className="flex max-w-reading flex-col gap-4">
            <h1 className="text-h1">Pricing for agencies</h1>
            <p className="text-text-2">
              Every agency can be listed for free. To manage your listing and hear from the
              businesses that find you, you need Pro.
            </p>
          </header>
        </div>

        <PlanColumns />

        <div className="-mt-6 flex max-w-reading flex-col gap-2 text-[15px] text-text-2">
          <p>
            Rankings can&apos;t be bought. Pro and Sponsored change where you&apos;re shown, never
            your ranking among agencies on the same plan.
          </p>
          <p>
            The Verified badge can&apos;t be bought. Any agency can apply, and it&apos;s only given
            when our checks pass.
          </p>
        </div>

        <section aria-labelledby="billing" className="flex max-w-reading flex-col gap-3">
          <h2 id="billing" className="text-h3">
            Cancelling and refunds
          </h2>
          <p className="text-text-2">
            Monthly: cancel any time. You keep Pro until the end of the month you&apos;ve paid for;
            there are no partial refunds. Yearly: a full refund if you ask within{" "}
            {COMPANY.refunds.yearlyFullRefundDays} days of paying. When Pro ends, your listing stays
            public, unmanaged, and we keep your details for when you come back.{" "}
            <Link href="/refunds" className="text-accent hover:underline">
              Refund policy
            </Link>
          </p>
        </section>

        <section aria-labelledby="badge" className="flex max-w-reading flex-col gap-3">
          <h2 id="badge" className="text-h3">
            The Verified badge is separate
          </h2>
          <p className="text-text-2">
            Any agency can ask us to verify it. We check its YouTube channels, its website and that
            it&apos;s a real business.{" "}
            <Link href="/how-we-rank" className="text-accent hover:underline">
              How we rank agencies
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
