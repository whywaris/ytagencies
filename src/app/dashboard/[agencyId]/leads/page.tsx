import { notFound } from "next/navigation";

import { getOwnedAgency } from "@/lib/auth";
import { BUDGET_RANGES } from "@/lib/validation/lead";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ params }: PageProps<"/dashboard/[agencyId]/leads">) {
  const owned = await getOwnedAgency((await params).agencyId);
  if (!owned) notFound();
  const { agency, supabase } = owned;

  // RLS: owners only see leads routed to their own agencies.
  const { data, error } = await supabase
    .from("lead_routes")
    .select(
      "sent_at, leads(id, name, email, company, budget_range, message, services(name), industries(name))",
    )
    .eq("agency_id", agency.id)
    .order("sent_at", { ascending: false });
  if (error) throw new Error("Couldn't load leads");
  const leads = data.flatMap((r) => (r.leads ? [{ ...r.leads, sentAt: r.sent_at }] : []));

  if (leads.length === 0) {
    return (
      <p className="max-w-reading text-text-2">
        No leads yet. When a business contacts you from your profile, or we match them with you,
        their request shows up here and in your email.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {leads.map((l) => {
        const need = [l.services?.name, l.industries?.name].filter(Boolean).join(" for ");
        const budget = BUDGET_RANGES.find((b) => b.value === l.budget_range)?.label;
        return (
          <li key={l.id} className="flex flex-col gap-3 rounded-lg border border-line p-5 md:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-h3">
                {l.name}
                {l.company && <span className="font-normal text-text-2">, {l.company}</span>}
              </h2>
              <time dateTime={l.sentAt} className="text-small">
                {new Date(l.sentAt).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </time>
            </div>
            <dl className="flex flex-col gap-1 text-small sm:flex-row sm:gap-6">
              <div className="flex gap-1">
                <dt>Type:</dt>
                <dd className="text-text">{need ? `Matched: ${need}` : "Direct message"}</dd>
              </div>
              {budget && (
                <div className="flex gap-1">
                  <dt>Budget:</dt>
                  <dd className="text-text">{budget}</dd>
                </div>
              )}
            </dl>
            {l.message && <p className="whitespace-pre-line">{l.message}</p>}
            <a
              href={`mailto:${l.email}`}
              className="flex min-h-11 items-center self-start text-accent hover:underline"
            >
              Reply to {l.email}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
