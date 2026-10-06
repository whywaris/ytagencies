import Link from "next/link";

import { DeleteLeadButton } from "@/components/admin/delete-lead-button";
import { Empty, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUDGET_RANGES } from "@/lib/validation/lead";

export const metadata = { title: "Leads" };

export default async function AdminLeadsPage() {
  await requireAdmin("/admin/leads");
  const { data: leads, error } = await createAdminClient()
    .from("leads")
    .select(
      "id, name, email, company, budget_range, message, created_at, services(name), industries(name), lead_routes(agencies(id, name, is_claimed))",
    )
    .order("created_at", { ascending: false })
    .limit(200); // ponytail: most recent 200; add paging or date filters when volume grows
  if (error) throw new Error("Couldn't load leads");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-admin-title">Leads</h1>
      <p className="max-w-reading text-text-2">
        Personal data: use it only to route and follow up on these requests. When someone asks for
        their details to be deleted, delete their lead here (routes go with it), and ask the
        agencies it was sent to to delete their copy.
      </p>
      {leads.length === 0 ? (
        <Empty>No leads yet.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">Received</th>
              <th scope="col">From</th>
              <th scope="col">Looking for</th>
              <th scope="col">Message</th>
              <th scope="col">Routed to</th>
              <th scope="col">
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const need = [l.services?.name, l.industries?.name].filter(Boolean).join(" for ");
              const budget = BUDGET_RANGES.find((b) => b.value === l.budget_range)?.label;
              return (
                <tr key={l.id} id={`lead-${l.id}`} className="target:bg-surface-2">
                  <td className="whitespace-nowrap text-text-2">
                    {new Date(l.created_at).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <span className="font-medium">{l.name}</span>
                    {l.company && <div className="text-small">{l.company}</div>}
                    <a
                      href={`mailto:${l.email}`}
                      className="text-small text-accent hover:underline"
                    >
                      {l.email}
                    </a>
                  </td>
                  <td>
                    {need || "Direct message"}
                    {budget && <div className="text-small">{budget}</div>}
                  </td>
                  <td className="max-w-[36ch] text-text-2">
                    <span className="line-clamp-3 whitespace-pre-line">{l.message ?? "—"}</span>
                  </td>
                  <td>
                    {l.lead_routes.length === 0 ? (
                      <span className="text-destructive">No match: follow up by hand</span>
                    ) : (
                      <ul>
                        {l.lead_routes.map((r) =>
                          r.agencies ? (
                            <li key={r.agencies.id}>
                              <Link
                                href={`/admin/agencies/${r.agencies.id}`}
                                className="hover:underline"
                              >
                                {r.agencies.name}
                              </Link>
                              {!r.agencies.is_claimed && (
                                <span className="text-small"> (unclaimed)</span>
                              )}
                            </li>
                          ) : null,
                        )}
                      </ul>
                    )}
                  </td>
                  <td>
                    <DeleteLeadButton id={l.id} name={l.name} />
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
