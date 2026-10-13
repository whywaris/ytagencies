import Link from "next/link";

import { SubmitAgencyForm } from "@/components/forms/submit-agency-form";
import { getProPrices } from "@/components/plan-columns";
import { yearlySaving } from "@/components/pro-billing";
import { requireUser } from "@/lib/auth";
import { checkoutAvailable } from "@/lib/billing";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { BRAND_NAME } from "@/lib/site";

// Sign-in required, so dynamic and noindex. /list-your-agency is the indexable page.
export const metadata = {
  title: { absolute: `Add your agency | ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

export default async function NewAgencyPage() {
  const user = await requireUser("/list-your-agency/new");
  const [services, industries, prices] = await Promise.all([
    getServices(),
    getIndustries(),
    getProPrices(),
  ]);
  const option = ({ slug, name }: { slug: string; name: string }) => ({ slug, name });

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-6 md:py-16">
      <header className="flex max-w-reading flex-col gap-2">
        <h1 className="text-h1">Add your agency</h1>
        <p className="text-text-2">
          Already listed?{" "}
          <Link href="/list-your-agency" className="text-accent hover:underline">
            Search and manage it
          </Link>{" "}
          instead. Adding an agency is free; we review it before it goes live.
        </p>
        <p className="text-small">Signed in as {user.email}.</p>
      </header>
      <SubmitAgencyForm
        services={services.map(option)}
        industries={industries.map(option)}
        live={checkoutAvailable()}
        prices={{ ...prices, saving: yearlySaving(prices.monthly, prices.yearly) }}
      />
    </div>
  );
}
