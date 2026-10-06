import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Empty, Pill, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getSeoPages, type SeoPage } from "@/lib/data/admin-seo";
import { formatCount, formatDate } from "@/lib/format";
import { MIN_AGENCIES_TO_INDEX } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata = { title: "SEO pages" };

const FILTERS: { id: string; label: string; test: (p: SeoPage) => boolean }[] = [
  { id: "", label: "All", test: () => true },
  { id: "missing", label: "Missing copy", test: (p) => p.copy === "missing" },
  {
    id: "close",
    label: "Close to indexable",
    test: (p) => p.agencies === MIN_AGENCIES_TO_INDEX - 1,
  },
  { id: "indexed", label: "Indexed", test: (p) => p.indexed },
];

const icon = "size-4 shrink-0 text-text-2 [stroke-width:1.5]";

export default async function AdminSeoPagesPage({ searchParams }: PageProps<"/admin/seo-pages">) {
  await requireAdmin("/admin/seo-pages");
  const raw = (await searchParams).filter;
  const filter = FILTERS.find((f) => f.id === raw) ?? FILTERS[0];
  const pages = await getSeoPages();
  const shown = pages.filter(filter.test);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-reading flex-col gap-1">
        <h1 className="text-admin-title">SEO pages</h1>
        <p className="text-text-2">
          Every service × industry and service × location page. A page is indexed once it has{" "}
          {MIN_AGENCIES_TO_INDEX} published agencies (docs/SEO.md); until then it&apos;s noindex and
          left out of the sitemap.
        </p>
      </div>

      <nav
        aria-label="Filter pages"
        className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line"
      >
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.id ? `/admin/seo-pages?filter=${f.id}` : "/admin/seo-pages"}
            aria-current={f === filter ? "page" : undefined}
            className="-mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-text-2 transition-colors duration-150 hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text"
          >
            {f.label}
            <span className="text-[12px] text-text-2 num">
              {formatCount(pages.filter(f.test).length)}
            </span>
          </Link>
        ))}
      </nav>

      {filter.id === "missing" && (
        <p className="text-admin-meta">
          Industry pages only: location pages share one template and have no copy of their own yet.
        </p>
      )}

      {shown.length === 0 ? (
        <Empty>
          {filter.id === "close"
            ? `No pages are one agency away from being indexed.`
            : filter.id === "indexed"
              ? `No pages are indexed yet. Pages need ${MIN_AGENCIES_TO_INDEX} published agencies.`
              : filter.id === "missing"
                ? "Every industry page has complete copy."
                : "No pages."}
        </Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col" className="text-right">
                Agencies
              </th>
              <th scope="col">Status</th>
              <th scope="col">Copy</th>
              <th scope="col" className="text-right">
                Leads (30d)
              </th>
              <th scope="col">Updated</th>
              <th scope="col">
                <span className="sr-only">Links</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.key}>
                <td className="min-w-56">
                  <span className="font-medium">
                    {p.service} {p.kind === "industry" ? "for" : "in"} {p.segment}
                  </span>
                  <div className="text-admin-meta">{p.path}</div>
                </td>
                <td className={cn("text-right num", p.agencies === 0 && "text-text-2")}>
                  {formatCount(p.agencies)}
                </td>
                <td>
                  <Pill on={p.indexed}>{p.indexed ? "Indexed" : "Noindex"}</Pill>
                </td>
                <td className="whitespace-nowrap">
                  {p.copy === "complete" ? (
                    "Complete"
                  ) : p.copy === "missing" ? (
                    <span className="text-warning">Missing</span>
                  ) : (
                    <span className="text-text-2">Shared template</span>
                  )}
                </td>
                <td
                  className={cn("text-right whitespace-nowrap num", !p.leads30d && "text-text-2")}
                >
                  {p.leads30d === null ? (
                    <span title="Leads don't record a location">Not tracked</span>
                  ) : (
                    formatCount(p.leads30d)
                  )}
                </td>
                <td className="whitespace-nowrap text-text-2 num">
                  {p.lastUpdated ? formatDate(p.lastUpdated) : "Never"}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-4 whitespace-nowrap">
                    {p.editHref && (
                      <Link href={p.editHref} className="text-accent hover:underline">
                        Edit copy
                        <span className="sr-only">
                          {" "}
                          for {p.service} {p.segment}
                        </span>
                      </Link>
                    )}
                    <a
                      href={p.path}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      Live
                      <ArrowUpRight className={icon} aria-hidden />
                      <span className="sr-only"> page (opens in a new tab)</span>
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
