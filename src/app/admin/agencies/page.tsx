import { ArrowDown, ArrowUp, Search } from "lucide-react";
import Link from "next/link";

import { AgenciesTable } from "@/components/admin/agencies-table";
import { AgencyFilters } from "@/components/admin/agency-filters";
import { Empty } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { formatCount } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Agencies" };

const PER_PAGE = 25;
const TABS = [
  { id: "", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Draft" },
  { id: "archived", label: "Archived" },
] as const;
const SORTS = { name: "name", updated: "updated_at", leads: "leads_30d" } as const;
type SortKey = keyof typeof SORTS;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function AdminAgenciesPage({ searchParams }: PageProps<"/admin/agencies">) {
  await requireAdmin("/admin/agencies");
  const sp = await searchParams;
  // Only characters that can't break PostgREST's or() syntax or act as LIKE wildcards.
  const q = one(sp.q)
    .replace(/[^\p{L}\p{N} .-]/gu, " ")
    .trim()
    .slice(0, 100);
  const status = TABS.some((t) => t.id === one(sp.status)) ? one(sp.status) : "";
  const filters = {
    claimed: ["yes", "no"].includes(one(sp.claimed)) ? one(sp.claimed) : "",
    verified: ["yes", "no"].includes(one(sp.verified)) ? one(sp.verified) : "",
    plan: ["free", "pro"].includes(one(sp.plan)) ? one(sp.plan) : "",
    service: one(sp.service),
    industry: one(sp.industry),
  };
  const sort: SortKey = one(sp.sort) in SORTS ? (one(sp.sort) as SortKey) : "updated";
  const dir =
    one(sp.dir) === "asc"
      ? "asc"
      : one(sp.dir) === "desc"
        ? "desc"
        : sort === "name"
          ? "asc"
          : "desc";
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);

  const [services, industries] = await Promise.all([getServices(), getIndustries()]);
  const serviceId = services.find((s) => s.slug === filters.service)?.id;
  const industryId = industries.find((i) => i.slug === filters.industry)?.id;

  const db = createAdminClient();
  // Same filters for the rows and for each tab's count; the tabs ignore the status filter.
  const query = (withStatus: boolean, head: boolean) => {
    let b = db.from("admin_agency_list").select("*", { count: "exact", head });
    if (q) b = b.or(`name.ilike.*${q}*,website.ilike.*${q}*,slug.ilike.*${q}*`);
    if (withStatus && status) b = b.eq("status", status);
    if (filters.claimed) b = b.eq("is_claimed", filters.claimed === "yes");
    if (filters.verified) b = b.eq("is_verified", filters.verified === "yes");
    if (filters.plan) b = b.eq("plan", filters.plan);
    if (serviceId) b = b.contains("service_ids", [serviceId]);
    if (industryId) b = b.contains("industry_ids", [industryId]);
    return b;
  };

  const from = (page - 1) * PER_PAGE;
  const [list, ...counts] = await Promise.all([
    query(true, false)
      .order(SORTS[sort], { ascending: dir === "asc" })
      .order("name", { ascending: true })
      .range(from, from + PER_PAGE - 1),
    ...TABS.map((t) => (t.id ? query(false, true).eq("status", t.id) : query(false, true))),
  ]);
  if (list.error || counts.some((c) => c.error)) throw new Error("Couldn't load agencies");
  const total = list.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const params = { q, status, ...filters, sort: sort === "updated" ? "" : sort, dir: "" };
  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams(
      Object.entries({ ...params, ...over }).filter(([, v]) => v) as [string, string][],
    );
    const s = p.toString();
    return s ? `/admin/agencies?${s}` : "/admin/agencies";
  };
  const sortHeader = (key: SortKey, label: string, align = "") => {
    const activeSort = sort === key;
    const nextDir = activeSort ? (dir === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc";
    const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={activeSort ? (dir === "asc" ? "ascending" : "descending") : undefined}
        className={align}
      >
        <Link
          href={href({ sort: key, dir: nextDir, page: "" })}
          className="inline-flex items-center gap-1 hover:text-text"
        >
          {label}
          {activeSort && <Arrow className="size-3 [stroke-width:1.5]" aria-hidden />}
        </Link>
      </th>
    );
  };

  const keepForFilters = Object.fromEntries(
    Object.entries({ q, status, sort: params.sort, dir: one(sp.dir) }).filter(([, v]) => v),
  ) as Record<string, string>;
  const opt = (rows: { slug: string; name: string }[]) =>
    rows.map((r) => ({ value: r.slug, label: r.name }));
  const filtered = q || Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-admin-title">Agencies</h1>
        <Button asChild className="h-9 px-4 text-[14px]">
          <Link href="/admin/agencies/new">New agency</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form
          method="get"
          action="/admin/agencies"
          role="search"
          className="relative min-w-60 flex-1"
        >
          {Object.entries({ status, ...filters, sort: params.sort })
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 [stroke-width:1.5] text-text-2"
            aria-hidden
          />
          <label htmlFor="agency-q" className="sr-only">
            Search agencies
          </label>
          <input
            id="agency-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name, website or slug"
            className="h-9 w-full rounded-lg border border-line bg-bg pr-3 pl-9 placeholder:text-text-2"
          />
        </form>
        <AgencyFilters
          values={filters}
          keep={keepForFilters}
          services={opt(services)}
          industries={opt(industries)}
        />
      </div>

      <nav aria-label="Filter by status" className="flex gap-1 border-b border-line">
        {TABS.map((t, i) => {
          const current = t.id === status;
          return (
            <Link
              key={t.label}
              href={href({ status: t.id, page: "" })}
              aria-current={current ? "page" : undefined}
              className="-mb-px flex h-10 items-center gap-2 border-b-2 border-transparent px-3 text-text-2 transition-colors duration-150 hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text"
            >
              {t.label}
              <span className="text-[12px] text-text-2 num">
                {formatCount(counts[i].count ?? 0)}
              </span>
            </Link>
          );
        })}
      </nav>

      {list.data.length === 0 ? (
        filtered ? (
          <Empty
            action={{
              href: href({
                q: "",
                claimed: "",
                verified: "",
                plan: "",
                service: "",
                industry: "",
                page: "",
              }),
              label: "Clear search and filters",
            }}
          >
            No agencies match {q ? <>&ldquo;{q}&rdquo; and </> : ""}these filters.
          </Empty>
        ) : (
          <Empty action={{ href: "/admin/agencies/new", label: "Add an agency" }}>
            No {status || ""} agencies yet.
          </Empty>
        )
      ) : (
        <>
          <AgenciesTable
            rows={list.data}
            header={
              <>
                {sortHeader("name", "Agency")}
                <th scope="col">Status</th>
                <th scope="col">Plan</th>
                <th scope="col">Verified</th>
                <th scope="col">Claimed</th>
                {sortHeader("leads", "Leads (30d)", "text-right")}
                {sortHeader("updated", "Updated")}
              </>
            }
          />
          <div className="flex items-center justify-between text-text-2">
            <p className="num">
              {formatCount(from + 1)}–{formatCount(from + list.data.length)} of {formatCount(total)}
            </p>
            {pages > 1 && (
              <nav aria-label="Pages" className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={href({ page: String(page - 1) })}
                    className="flex h-8 items-center rounded-lg border border-line px-3 hover:bg-surface-2"
                  >
                    Previous
                  </Link>
                ) : null}
                <span className="px-1 num">
                  Page {page} of {pages}
                </span>
                {page < pages ? (
                  <Link
                    href={href({ page: String(page + 1) })}
                    className="flex h-8 items-center rounded-lg border border-line px-3 hover:bg-surface-2"
                  >
                    Next
                  </Link>
                ) : null}
              </nav>
            )}
          </div>
        </>
      )}
    </div>
  );
}
