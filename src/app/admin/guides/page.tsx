import { ArrowUpRight, Search } from "lucide-react";
import Link from "next/link";

import { Empty, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { formatCount, formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata = { title: "Guides" };

const TABS = [
  { id: "", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
] as const;

type G = {
  id: string;
  slug: string;
  title: string;
  status: string;
  published_at: string | null;
  updated_at: string;
};

/** What a reader sees: a scheduled guide whose time has passed is published. */
function shownStatus(g: G, now: Date) {
  if (g.status === "draft" || g.status === "in_review") return "draft"; // in_review: no UI yet
  return g.published_at && new Date(g.published_at) <= now ? "published" : "scheduled";
}

const DOT = { draft: "bg-text-2", scheduled: "bg-accent", published: "bg-success" } as const;
const LABEL = { draft: "Draft", scheduled: "Scheduled", published: "Published" } as const;

export default async function AdminGuidesPage({ searchParams }: PageProps<"/admin/guides">) {
  await requireAdmin("/admin/guides");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.status)?.id ?? "";
  const q = (typeof sp.q === "string" ? sp.q : "")
    .replace(/[%_*,()]/g, " ")
    .trim()
    .slice(0, 100);

  let query = createAdminClient()
    .from("guides")
    .select("id, slug, title, status, published_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500); // ponytail: no paging; add it past a few hundred guides
  if (q) query = query.ilike("title", `%${q}%`);
  const { data, error } = await query;
  if (error) throw new Error("Couldn't load guides");

  const now = new Date();
  const counts = { "": data.length, draft: 0, scheduled: 0, published: 0 };
  for (const g of data) counts[shownStatus(g, now)]++;
  const shown = tab ? data.filter((g) => shownStatus(g, now) === tab) : data;
  const href = (status: string) => {
    const p = new URLSearchParams(Object.entries({ status, q }).filter(([, v]) => v));
    return p.size ? `/admin/guides?${p}` : "/admin/guides";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-admin-title">Guides</h1>
        <Button asChild className="h-9 px-4 text-[14px]">
          <Link href="/admin/guides/new">New guide</Link>
        </Button>
      </div>

      <form method="get" role="search" className="relative max-w-md">
        {tab && <input type="hidden" name="status" value={tab} />}
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 [stroke-width:1.5] text-text-2"
          aria-hidden
        />
        <label htmlFor="guide-q" className="sr-only">
          Search guides
        </label>
        <input
          id="guide-q"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by title"
          className="h-9 w-full rounded-lg border border-line bg-bg pr-3 pl-9 placeholder:text-text-2"
        />
      </form>

      <nav
        aria-label="Filter by status"
        className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line"
      >
        {TABS.map((t) => (
          <Link
            key={t.label}
            href={href(t.id)}
            aria-current={t.id === tab ? "page" : undefined}
            className="-mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-text-2 transition-colors duration-150 hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text"
          >
            {t.label}
            <span className="text-[12px] text-text-2 num">{formatCount(counts[t.id])}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        q ? (
          <Empty action={{ href: href(tab), label: "Clear search" }}>
            No guides match &ldquo;{q}&rdquo;.
          </Empty>
        ) : (
          <Empty action={{ href: "/admin/guides/new", label: "Write a guide" }}>
            No {tab ? LABEL[tab].toLowerCase() : ""} guides yet.
          </Empty>
        )
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Status</th>
              <th scope="col">Published</th>
              <th scope="col">Updated</th>
              <th scope="col">
                <span className="sr-only">Live page</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => {
              const s = shownStatus(g, now);
              return (
                <tr key={g.id}>
                  <td className="min-w-64">
                    <Link href={`/admin/guides/${g.id}`} className="font-medium hover:underline">
                      {g.title}
                    </Link>
                    <div className="text-admin-meta">/guides/{g.slug}</div>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span aria-hidden className={cn("size-1.5 rounded-full", DOT[s])} />
                      {LABEL[s]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-text-2 num">
                    {g.published_at && g.status !== "draft"
                      ? formatDate(g.published_at)
                      : "Not yet"}
                  </td>
                  <td className="whitespace-nowrap text-text-2 num">{formatDate(g.updated_at)}</td>
                  <td className="text-right">
                    {s === "published" && (
                      <a
                        href={`/guides/${g.slug}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 whitespace-nowrap hover:underline"
                      >
                        View live
                        <ArrowUpRight
                          className="size-4 [stroke-width:1.5] text-text-2"
                          aria-hidden
                        />
                        <span className="sr-only"> {g.title} (opens in a new tab)</span>
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
