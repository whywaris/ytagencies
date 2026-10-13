import { notFound } from "next/navigation";

import { MarkContacted } from "@/components/dashboard/mark-contacted";
import { getOwnedAgency } from "@/lib/auth";
import { getEntitlements } from "@/lib/data/entitlements";
import { BUDGET_RANGES } from "@/lib/validation/lead";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ params }: PageProps<"/dashboard/[agencyId]/leads">) {
  const owned = await getOwnedAgency((await params).agencyId);
  if (!owned) notFound();
  const { agency, supabase } = owned;

  // RLS: owners only see leads routed to their own agencies. Past leads stay readable after Pro
  // ends; Mark as contacted needs Pro (it feeds the reply time on the profile).
  const e = await getEntitlements(agency.id);
  const { data, error } = await supabase
    .from("lead_routes")
    .select(
      "sent_at, contacted_at, leads(id, name, email, company, budget_range, message, services(name), industries(name))",
    )
    .eq("agency_id", agency.id)
    .order("sent_at", { ascending: false });
  if (error) throw new Error("Couldn't load leads");
  const leads = data.flatMap((r) =>
    r.leads ? [{ ...r.leads, sentAt: r.sent_at, contactedAt: r.contacted_at }] : [],
  );
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

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
          <li
            key={l.id}
            id={`lead-${l.id}`}
            className="flex scroll-mt-20 flex-col gap-3 rounded-lg border border-line p-5 md:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-h3">
                {l.name}
                {l.company && <span className="font-normal text-text-2">, {l.company}</span>}
              </h2>
              <time dateTime={l.sentAt} className="text-small">
                {day(l.sentAt)}
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
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <a
                href={`mailto:${l.email}`}
                className="flex min-h-11 items-center text-accent hover:underline"
              >
                Reply to {l.email}
              </a>
              {l.contactedAt ? (
                <p className="text-small">Contacted {day(l.contactedAt)}</p>
              ) : (
                e.managed && <MarkContacted agencyId={agency.id} leadId={l.id} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
