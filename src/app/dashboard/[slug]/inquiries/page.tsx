import Link from "next/link";

import { MarkContacted } from "@/components/dashboard/mark-contacted";
import { dashboardContext, type DashboardContext } from "@/lib/data/dashboard";
import { toPreview } from "@/lib/lead-preview";
import {
  budgetLabel,
  choiceLabel,
  GOALS,
  PRIOR_AGENCY,
  START_TIMELINES,
} from "@/lib/validation/lead";

export const metadata = { title: "Inquiries" };

export default async function LeadsPage({ params }: PageProps<"/dashboard/[slug]/inquiries">) {
  const ctx = await dashboardContext((await params).slug);
  // Free (or lapsed): previews without contact details (lead_previews, schema.sql). Pro: the full
  // request; RLS refuses contact details to owners who aren't on Pro.
  if (!ctx.e.leadDetails) return <Previews ctx={ctx} />;
  const { agency, supabase } = ctx;

  // RLS: owners only see leads routed to their own agencies.
  const { data, error } = await supabase
    .from("lead_routes")
    .select(
      "sent_at, contacted_at, leads(id, name, email, company, budget_range, message, goal, start_timeline, business_url, channel_url, customer_location, prior_agency, services(name), industries(name))",
    )
    .eq("agency_id", agency.id)
    .order("sent_at", { ascending: false });
  if (error) throw new Error("Couldn't load leads");
  // Opened as Pro: the 48-hour fallback (lib/lead-fallback.tsx) leaves these with this agency.
  await supabase
    .from("lead_routes")
    .update({ opened_at: new Date().toISOString() })
    .eq("agency_id", agency.id)
    .is("opened_at", null);
  const leads = data.flatMap((r) =>
    r.leads ? [{ ...r.leads, sentAt: r.sent_at, contactedAt: r.contacted_at }] : [],
  );

  if (leads.length === 0) {
    return (
      <p className="max-w-reading text-text-2">
        No inquiries yet. When a business sends a request from your profile, or we match them with
        you, it shows up here and in your email.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {leads.map((l) => {
        const need = [l.services?.name, l.industries?.name].filter(Boolean).join(" for ");
        const budget = budgetLabel(l.budget_range);
        // Request proposals answers (requests sent before the two-step form have none).
        const answers: [string, string | null, "link"?][] = [
          ["Main goal", choiceLabel(GOALS, l.goal)],
          ["Wants to start", choiceLabel(START_TIMELINES, l.start_timeline)],
          ["Customers in", l.customer_location],
          ["Worked with an agency before", choiceLabel(PRIOR_AGENCY, l.prior_agency)],
          ["Website", l.business_url, "link"],
          ["YouTube channel", l.channel_url, "link"],
        ];
        const shown = answers.filter(([, v]) => v);
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
            {shown.length > 0 && (
              <dl className="grid gap-x-6 gap-y-2 rounded-lg bg-surface p-4 text-[15px] sm:grid-cols-2">
                {shown.map(([label, value, kind]) => (
                  <div key={label} className="flex min-w-0 flex-col">
                    <dt className="text-small">{label}</dt>
                    <dd className="truncate">
                      {kind === "link" ? (
                        <a
                          href={value!}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-accent hover:underline"
                        >
                          {value!.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                        </a>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
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
                <MarkContacted agencyId={agency.id} leadId={l.id} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

/** What a free owner sees: never a name, email, company, link or the full message. */
async function Previews({ ctx }: { ctx: DashboardContext }) {
  const { agency, supabase } = ctx;
  const { data, error } = await supabase.rpc("lead_previews", { p_agency: agency.id });
  if (error) throw new Error("Couldn't load requests");
  const upgrade = (
    <Link href={`/dashboard/${agency.slug}/billing`} className="font-semibold text-accent hover:underline">
      Upgrade to Pro to see contact details and reply.
    </Link>
  );
  if (data.length === 0)
    return (
      <p className="max-w-reading text-text-2">
        No requests yet. When a business sends a request from your profile, a preview shows up
        here and in your email.
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-reading rounded-2xl bg-(--accent-soft) px-[18px] py-4 text-[15px]">
        You&apos;re on Free, so you see a preview of each request without the client&apos;s
        details. {upgrade} Requests nobody on Pro opens within 48 hours go to similar agencies.
      </p>
      <ul className="flex flex-col gap-3">
        {data.map((r) => {
          const p = toPreview({
            service: r.service,
            industry: r.industry,
            budget: budgetLabel(r.budget_range),
            timeline: choiceLabel(START_TIMELINES, r.start_timeline),
            goal: choiceLabel(GOALS, r.goal),
            country: r.country,
            summary: r.summary,
          });
          const rows: [string, string | null][] = [
            ["Service", p.service],
            ["Niche", p.industry],
            ["Budget", p.budget],
            ["Wants to start", p.timeline],
            ["Main goal", p.goal],
            ["Country", p.country],
          ];
          return (
            <li
              key={r.lead_id}
              id={`lead-${r.lead_id}`}
              className="flex scroll-mt-20 flex-col gap-3 rounded-lg border border-line p-5 md:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-h3">
                  {r.via === "direct" ? "Request from your profile" : "Matched request"}
                </h2>
                <time dateTime={r.sent_at} className="text-small">
                  {day(r.sent_at)}
                </time>
              </div>
              <dl className="grid gap-x-6 gap-y-2 rounded-lg bg-surface p-4 text-[15px] sm:grid-cols-2">
                {rows
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label} className="flex min-w-0 flex-col">
                      <dt className="text-small">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
              {p.summary && <p className="text-text-2">“{p.summary}”</p>}
              <p className="text-[15px]">{upgrade}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
