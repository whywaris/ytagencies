import { Breadcrumbs } from "@/components/breadcrumbs";
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

export default async function GetMatchedPage() {
  const [services, industries] = await Promise.all([getServices(), getIndustries()]);
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <div className="mx-auto flex max-w-reading flex-col gap-8 px-4 py-12 md:py-20">
        <Breadcrumbs items={breadcrumbs} />
        <header className="flex flex-col gap-4">
          <h1 className="text-h1">Get matched with YouTube agencies</h1>
          <p className="text-text-2">
            Tell us what you need. We&apos;ll send your request to up to 3 agencies that do that
            work for your industry and budget, and they&apos;ll reply to you directly. It&apos;s
            free.
          </p>
        </header>
        <GetMatchedForm
          services={services.map((s) => ({ slug: s.slug, name: s.name }))}
          industries={industries.map((i) => ({ slug: i.slug, name: i.name }))}
        />
      </div>
    </>
  );
}
