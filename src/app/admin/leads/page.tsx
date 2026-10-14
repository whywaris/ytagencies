import { Download } from "lucide-react";
import Link from "next/link";

import { LeadsTable, type LeadRow } from "@/components/admin/leads-table";
import { Empty } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { formatCount } from "@/lib/format";
import { applyLeadFilters, leadFilterParams, parseLeadFilters } from "@/lib/leads-filter";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUDGET_RANGES, budgetLabel } from "@/lib/validation/lead";

export const metadata = { title: "Leads" };

const PER_PAGE = 50;
const control = "h-9 rounded-lg border border-line bg-bg px-2";

export default async function AdminLeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  await requireAdmin("/admin/leads");
  const sp = await searchParams;
  const f = parseLeadFilters(sp);
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "", 10) || 1);
  const [services, industries] = await Promise.all([getServices(), getIndustries()]);
  const ids = {
    serviceId: services.find((s) => s.slug === f.service)?.id,
    industryId: industries.find((i) => i.slug === f.industry)?.id,
  };

  const from = (page - 1) * PER_PAGE;
  const { data, count, error } = await applyLeadFilters(
    createAdminClient()
      .from("leads")
      .select(
        "id, name, email, company, budget_range, message, created_at, services(name), industries(name), lead_routes(sent_at, agencies(id, name, is_claimed)), deleted_agency_routes(agency_id, agency_name, sent_at)",
        { count: "exact" },
      ),
    f,
    ids,
  )
    .order("created_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);
  if (error) throw new Error("Couldn't load leads");

  const leads: LeadRow[] = data.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    company: l.company,
    need: [l.services?.name, l.industries?.name && `for ${l.industries.name}`]
      .filter(Boolean)
      .join(" "),
    budget: l.budget_range ? (budgetLabel(l.budget_range) ?? l.budget_range) : null,
    message: l.message,
    createdAt: l.created_at,
    routes: [
      ...l.lead_routes.flatMap((r) =>
        r.agencies
          ? [
              {
                agencyId: r.agencies.id,
                agencyName: r.agencies.name,
                claimed: r.agencies.is_claimed,
                deleted: false,
                sentAt: r.sent_at,
              },
            ]
          : [],
      ),
      // Agencies deleted since: their name was kept on the lead (delete_agencies).
      ...l.deleted_agency_routes.map((r) => ({
        agencyId: r.agency_id,
        agencyName: r.agency_name,
        claimed: true,
        deleted: true,
        sentAt: r.sent_at,
      })),
    ].sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
  }));

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const params = leadFilterParams(f);
  const pageHref = (p: number) => {
    const q = new URLSearchParams(params);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/admin/leads?${s}` : "/admin/leads";
  };
  const filtered = params.toString() !== "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-reading flex-col gap-1">
          <h1 className="text-admin-title">Leads</h1>
          <p className="text-text-2">
            Personal data: use it only to route and follow up on these requests. When someone asks
            for their details to be deleted, delete their lead here and ask the agencies it was sent
            to to delete their copy.
          </p>
        </div>
        {total > 0 && (
          <a
            href={`/admin/leads/export${filtered ? `?${params}` : ""}`}
            className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2"
          >
            <Download className="size-4 [stroke-width:1.5] text-text-2" aria-hidden />
            Export CSV
          </a>
        )}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filter leads">
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <span className="text-admin-meta">Email or company</span>
          <input
            type="search"
            name="q"
            defaultValue={f.q}
            className={`${control} px-3`}
            placeholder="Search"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-admin-meta">Service</span>
          <select name="service" defaultValue={f.service} className={control}>
            <option value="">Any</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-admin-meta">Industry</span>
          <select name="industry" defaultValue={f.industry} className={control}>
            <option value="">Any</option>
            {industries.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-admin-meta">Budget</span>
          <select name="budget" defaultValue={f.budget} className={control}>
            <option value="">Any</option>
            {BUDGET_RANGES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-admin-meta">From</span>
          <input type="date" name="from" defaultValue={f.from} className={`${control} num`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-admin-meta">To</span>
          <input type="date" name="to" defaultValue={f.to} className={`${control} num`} />
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90"
        >
          Apply
        </button>
        {filtered && (
          <Link
            href="/admin/leads"
            className="flex h-9 items-center px-1 text-text-2 hover:text-text hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      {leads.length === 0 ? (
        filtered ? (
          <Empty action={{ href: "/admin/leads", label: "Clear filters" }}>
            No leads match these filters.
          </Empty>
        ) : (
          <Empty>No leads yet. Requests from Get matched and agency profiles appear here.</Empty>
        )
      ) : (
        <>
          <LeadsTable leads={leads} />
          <div className="flex items-center justify-between text-text-2">
            <p className="num">
              {formatCount(from + 1)}–{formatCount(from + leads.length)} of {formatCount(total)}
            </p>
            {pages > 1 && (
              <nav aria-label="Pages" className="flex items-center gap-2">
                {page > 1 && (
                  <Link
                    href={pageHref(page - 1)}
                    className="flex h-8 items-center rounded-lg border border-line px-3 hover:bg-surface-2"
                  >
                    Previous
                  </Link>
                )}
                <span className="px-1 num">
                  Page {page} of {pages}
                </span>
                {page < pages && (
                  <Link
                    href={pageHref(page + 1)}
                    className="flex h-8 items-center rounded-lg border border-line px-3 hover:bg-surface-2"
                  >
                    Next
                  </Link>
                )}
              </nav>
            )}
          </div>
        </>
      )}
    </div>
  );
}
