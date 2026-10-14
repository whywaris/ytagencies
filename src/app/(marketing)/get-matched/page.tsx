import { Check } from "lucide-react";
import Link from "next/link";

import { GetMatchedForm } from "@/components/forms/get-matched-form";
import { JsonLd } from "@/components/json-ld";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: `Get matched with YouTube agencies | ${BRAND_NAME}`,
  description:
    "Tell us what you need and we'll send your request to up to 3 YouTube agencies that fit your service, industry and budget. They reply to you directly. Free.",
  path: "/get-matched",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Get matched", path: "/get-matched" },
];

const NEXT = [
  {
    title: "We pick up to 3 agencies",
    body: "Ones that offer this service and work in your industry.",
  },
  { title: "They email you directly", body: "With ideas and prices for your business." },
  { title: "You choose", body: "Reply to the ones you like. No obligation." },
];
const TRUST = [
  "Free for businesses",
  "3 agencies at most, no spam",
  "Your details go only to them",
  "We never take a cut",
];

export default async function GetMatchedPage() {
  const [services, industries] = await Promise.all([getServices(), getIndustries()]);
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      {/* No visible breadcrumb (the BreadcrumbList JSON-LD above stays for search). */}
      <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-4 py-10 md:px-6 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] lg:gap-14">
          <div className="flex min-w-0 flex-col gap-8">
            <header className="flex flex-col gap-4">
              <h1 className="text-[clamp(34px,4.6vw,52px)] leading-[1.05] font-[680] tracking-[-0.035em]">
                Tell us what you need.
                <br />
                <span className="text-accent">We&apos;ll find who fits.</span>
              </h1>
              <p className="text-[18px] text-text-2">
                Up to 3 agencies that do this work for your industry will reply to you directly.
                Free, takes about a minute.
              </p>
            </header>
            <GetMatchedForm
              services={services.map((s) => ({ slug: s.slug, name: s.name }))}
              industries={industries.map((i) => ({ slug: i.slug, name: i.name }))}
            />
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-[76px] lg:self-start">
            <section
              aria-labelledby="next-heading"
              className="flex flex-col gap-4 rounded-[22px] border border-line bg-raised p-6"
            >
              <h2 id="next-heading" className="text-h3">
                What happens next
              </h2>
              <ol className="flex flex-col gap-4">
                {NEXT.map((n, i) => (
                  <li key={n.title} className="flex gap-3">
                    <span
                      aria-hidden
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[14px] font-semibold text-(--accent-on-soft)"
                    >
                      {i + 1}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold">{n.title}</span>
                      <span className="text-[15px] text-text-2">{n.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            <section aria-label="Our promises" className="rounded-[22px] bg-surface p-6">
              <ul className="flex flex-col gap-2.5">
                {TRUST.map((t) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <Check
                      className="size-4 shrink-0 [stroke-width:2.5] text-verified"
                      aria-hidden
                    />
                    {t}
                  </li>
                ))}
              </ul>
            </section>
            <p className="px-1 text-text-2">
              Prefer to choose yourself?{" "}
              <Link href="/#services" className="font-medium text-accent hover:underline">
                Browse agencies
              </Link>
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}
