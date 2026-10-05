import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getServices } from "@/lib/data/taxonomy";

/** 404 body shared by the root not-found (unmatched URLs) and the (marketing) one (notFound()). */
export async function NotFoundContent() {
  // A broken database shouldn't turn a 404 into a 500: fall back to no links.
  const services = await getServices().catch(() => []);
  return (
    <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-20 md:px-6 md:py-30">
      <div className="flex max-w-reading flex-col gap-4">
        <h1 className="text-h1">We can&apos;t find that page</h1>
        <p className="text-text-2">
          The link may be old, or the agency may no longer be listed. Pick a service to browse
          agencies, or tell us what you need and we&apos;ll match you.
        </p>
        <Button asChild className="self-start">
          <Link href="/get-matched">Get matched</Link>
        </Button>
      </div>
      {services.length > 0 && (
        <section aria-labelledby="browse" className="flex flex-col gap-4">
          <h2 id="browse" className="text-h3">
            Browse by service
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/${s.slug}`}
                  className="flex min-h-11 items-center rounded-lg border border-line px-5 py-4 font-medium transition-colors duration-150 hover:border-text-2"
                >
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
