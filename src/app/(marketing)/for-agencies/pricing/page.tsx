import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { paymentsEnabled } from "@/lib/billing";
import { getPlanPrices } from "@/lib/data/placement";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/site";

export const revalidate = 3600;

// ADMIN_V2_SPEC §6. While PAYMENTS_ENABLED isn't "true", Verified is free for Founding agencies
// and Sponsored placements are arranged by email.

export const metadata = buildMetadata({
  title: `Pricing for YouTube agencies | ${BRAND_NAME}`,
  description:
    "List your YouTube agency for free. Upgrade to Verified for a website link, higher placement and priority in matched leads, or sponsor a directory page.",
  path: "/for-agencies/pricing",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "List your agency", path: "/list-your-agency" },
  { name: "Pricing", path: "/for-agencies/pricing" },
];

/** Sponsored slots are priced per page and arranged by hand for now. */
const SPONSORED_FROM_USD = 49;

const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export default async function PricingPage() {
  const plans = await getPlanPrices();
  const verified = plans.get("verified");
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
              Every agency can list for free. Paid plans move you up the directory and send you more
              of the leads that fit.
            </p>
          </header>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Plan
            name="Free"
            price={<>$0</>}
            summary="A profile businesses can find and contact."
            features={[
              "Profile on every page for your services, industries and locations",
              "Inquiries through your profile's contact form",
              "Up to 2 case studies",
              "30 days of profile analytics",
            ]}
            cta={
              <Button asChild variant="link" className="self-start">
                <Link href="/list-your-agency">List your agency</Link>
              </Button>
            }
          />
          <Plan
            name="Verified"
            highlight
            price={
              verified?.price_monthly ? (
                <>
                  {usd(Number(verified.price_monthly))}
                  <span className="text-[17px] font-normal text-text-2"> a month</span>
                </>
              ) : (
                <>Paid plan</>
              )
            }
            note={
              live
                ? verified?.price_yearly
                  ? `or ${usd(Number(verified.price_yearly))} a year`
                  : undefined
                : "Free during launch: join as a Founding agency."
            }
            summary="For agencies that want more of the right leads."
            features={[
              "Everything in Free",
              "Listed above Free agencies on directory pages",
              "Priority when we match businesses with agencies",
              "A link to your website, tagged so you can track visits",
              "Unlimited case studies",
              "12 months of profile analytics",
              "No other agencies suggested on your profile",
              "Can sponsor directory pages",
            ]}
            cta={
              <Button asChild className="self-start">
                <Link href="/list-your-agency">
                  {live ? "Get Verified" : "Join as a Founding agency"}
                </Link>
              </Button>
            }
          />
          <Plan
            name="Sponsored"
            price={
              <>
                From {usd(SPONSORED_FROM_USD)}
                <span className="text-[17px] font-normal text-text-2"> a month per page</span>
              </>
            }
            summary="The top of a directory page, labeled Sponsored."
            features={[
              "Up to 3 sponsored agencies per page, shown first",
              "Clearly labeled Sponsored",
              "Pick the service, industry or location pages that matter to you",
              "For agencies on a paid plan (Founding or Verified) with the Verified badge",
            ]}
            cta={
              <Button asChild variant="link" className="self-start">
                <a href={`mailto:${CONTACT_EMAIL}?subject=Sponsored%20placement`}>Contact us</a>
              </Button>
            }
          />
        </div>

        <section aria-labelledby="badge" className="flex max-w-reading flex-col gap-3">
          <h2 id="badge" className="text-h3">
            The Verified badge is separate
          </h2>
          <p className="text-text-2">
            Any agency, on any plan, can ask us to verify it. We check its YouTube channels, its
            website and that it&apos;s a real business. Paid plans are reviewed first.{" "}
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
  note,
  summary,
  features,
  cta,
  highlight = false,
}: {
  name: string;
  price: React.ReactNode;
  note?: string;
  summary: string;
  features: string[];
  cta: React.ReactNode;
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
        <p className="text-h2">{price}</p>
        {note && <p className="font-medium text-accent">{note}</p>}
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
