import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

/** Shared shell for /privacy and /terms: reading width, breadcrumb, last-updated date. */
export function LegalPage({
  title,
  path,
  updated,
  children,
}: {
  title: string;
  path: string;
  updated: string;
  children: React.ReactNode;
}) {
  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: title, path },
  ];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <article className="mx-auto flex max-w-reading flex-col gap-6 px-4 py-12 md:py-20 [&_h2]:mt-6 [&_h2]:text-h3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        <Breadcrumbs items={breadcrumbs} />
        <header className="flex flex-col gap-2">
          <h1 className="text-h1">{title}</h1>
          <p className="text-small">Last updated {updated}</p>
        </header>
        {children}
      </article>
    </>
  );
}
