import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { ProBilling } from "@/components/pro-billing";
import { Button } from "@/components/ui/button";
import { paymentsEnabled } from "@/lib/billing";
import { COMPANY } from "@/lib/company";
import { getPlanPrices } from "@/lib/data/placement";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/site";

export const revalidate = 3600;

// Listings are free; managing one takes Pro (lib/entitlements.ts). While PAYMENTS_ENABLED isn't
// "true", Get Pro opens the Request Pro form and Sponsored placements are arranged by email.

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

/** Sponsored slots are priced per page and arranged by hand for now. */
const SPONSORED_FROM_USD = 49;
/** Fallbacks if the plans table can't be read: the launch prices. */
const PRO_MONTHLY_USD = 29;
const PRO_YEARLY_USD = 279;

export default async function PricingPage() {
  const pro = (await getPlanPrices()).get("pro");
  const live = paymentsEnabled();

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

        <div className="grid gap-6 lg:grid-cols-3">
          <Plan
            name="Listing"
            price={<p className="text-h2">Free</p>}
            summary="Listed by us or submitted by you. Businesses can find you, but can't contact you."
            features={[
              "Profile on the pages for your services, industries and locations",
              "Visitors are offered Get matched with agencies on Pro",
              "Can earn the Verified badge",
            ]}
            cta={
              <Button asChild variant="link" className="self-start">
                <Link href="/list-your-agency">List your agency</Link>
              </Button>
            }
          />
          <Plan
            name="Pro"
            highlight
            price={
              <ProBilling
                monthly={Number(pro?.price_monthly ?? PRO_MONTHLY_USD)}
                yearly={Number(pro?.price_yearly ?? PRO_YEARLY_USD)}
                live={live}
              />
            }
            summary="Manage your listing and receive inquiries."
            features={[
              "Edit your profile any time",
              "A contact form on your profile: inquiries go straight to you",
              "Requests from Get matched that fit your services",
              "Listed above unmanaged agencies on directory pages",
              "A link to your website, tagged so you can track visits",
              "Your reply time on your profile",
              "Unlimited case studies and channels",
              "No other agencies suggested on your profile",
              "12 months of profile analytics",
              "Can sponsor directory pages",
            ]}
          />
          <Plan
            name="Sponsored"
            price={
              <p className="text-h2">
                From ${SPONSORED_FROM_USD}
                <span className="text-[17px] font-normal text-text-2"> a month per page</span>
              </p>
            }
            summary="The top of a directory page, labeled Sponsored."
            features={[
              "Up to 3 sponsored agencies per page, shown first",
              "Clearly labeled Sponsored",
              "Pick the service, industry or location pages that matter to you",
              "For agencies on Pro with the Verified badge",
            ]}
            cta={
              <Button asChild variant="link" className="self-start">
                <a href={`mailto:${CONTACT_EMAIL}?subject=Sponsored%20placement`}>Contact us</a>
              </Button>
            }
          />
        </div>

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

function Plan({
  name,
  price,
  summary,
  features,
  cta,
  highlight = false,
}: {
  name: string;
  price: React.ReactNode;
  summary: string;
  features: string[];
  cta?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <section
      aria-labelledby={`plan-${name}`}
      className={`flex flex-col gap-6 rounded-lg border p-6 ${highlight ? "border-accent" : "border-line"}`}
    >
      <div className="flex flex-col gap-2">
        <h2 id={`plan-${name}`} className="text-h3">
          {name}
        </h2>
        {price}
        <p className="text-text-2">{summary}</p>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className="text-text-2">
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>
      {cta}
    </section>
  );
}
