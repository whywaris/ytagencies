import { type NextRequest } from "next/server";

import { adminContext } from "@/lib/admin-context";
import { toCsv } from "@/lib/csv";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { applyLeadFilters, parseLeadFilters } from "@/lib/leads-filter";
import { BUDGET_RANGES } from "@/lib/validation/lead";

// CSV export of the admin leads table with the same filters (ADMIN_V2_SPEC §5.5). Personal data:
// admin only, never cached, logged to admin_actions (filters and row count, no lead details).

const PAGE = 1000; // PostgREST's default max rows per request

export async function GET(request: NextRequest) {
  const ctx = await adminContext();
  if (!ctx) return new Response("Not found", { status: 404 });

  const f = parseLeadFilters(Object.fromEntries(request.nextUrl.searchParams));
  const [services, industries] = await Promise.all([getServices(), getIndustries()]);
  const ids = {
    serviceId: services.find((s) => s.slug === f.service)?.id,
    industryId: industries.find((i) => i.slug === f.industry)?.id,
  };

  type Row = {
    name: string;
    email: string;
    company: string | null;
    budget_range: string | null;
    message: string | null;
    created_at: string;
    services: { name: string } | null;
    industries: { name: string } | null;
    lead_routes: { agencies: { name: string } | null }[];
    deleted_agency_routes: { agency_name: string }[];
  };
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await applyLeadFilters(
      ctx.db
        .from("leads")
        .select(
          "name, email, company, budget_range, message, created_at, services(name), industries(name), lead_routes(agencies(name)), deleted_agency_routes(agency_name)",
        ),
      f,
      ids,
    )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return new Response("Couldn't export leads", { status: 500 });
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  const budget = new Map<string, string>(BUDGET_RANGES.map((b) => [b.value, b.label]));
  const csv = toCsv(
    [
      "Received (UTC)",
      "Name",
      "Email",
      "Company",
      "Service",
      "Industry",
      "Budget",
      "Message",
      "Sent to",
    ],
    rows.map((l) => [
      l.created_at.replace("T", " ").slice(0, 16),
      l.name,
      l.email,
      l.company,
      l.services?.name,
      l.industries?.name,
      l.budget_range ? (budget.get(l.budget_range) ?? l.budget_range) : null,
      l.message,
      [
        ...l.lead_routes.map((r) => r.agencies?.name),
        ...l.deleted_agency_routes.map((r) => `${r.agency_name} (deleted)`),
      ]
        .filter(Boolean)
        .join("; "),
    ]),
  );
  await ctx.log("lead.export", "lead", null, {
    rows: rows.length,
    // The search text is often an email address: log only that there was one.
    filters: Object.fromEntries(
      Object.entries({ ...f, q: f.q ? "(search)" : "" }).filter(([, v]) => v),
    ),
  });

  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${day}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
