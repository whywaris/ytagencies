import { MarkContacted } from "@/components/dashboard/mark-contacted";
import { Paywall } from "@/components/dashboard/paywall";
import { dashboardContext } from "@/lib/data/dashboard";
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
  // Never on Pro: the paywall. Lapsed: past inquiries, read-only (RLS refuses changes too).
  if (!ctx.e.managed && !ctx.lapsed)
    return (
      <Paywall
        ctx={ctx}
        unlocks="With Pro, businesses contact you and their inquiries land here."
      />
    );
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
  const leads = data.flatMap((r) =>
    r.leads ? [{ ...r.leads, sentAt: r.sent_at, contactedAt: r.contacted_at }] : [],
  );
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

  if (leads.length === 0) {
    return (
      <p className="max-w-reading text-text-2">
        {ctx.e.managed
          ? "No inquiries yet. When a business contacts you from your profile, or we match them with you, their request shows up here and in your email."
          : "No inquiries arrived while you were on Pro."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {leads.map((l) => {
        const need = [l.services?.name, l.industries?.name].filter(Boolean).join(" for ");
        const budget = budgetLabel(l.budget_range);
        // Get matched answers (requests sent before the two-step form have none).
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
                ctx.e.managed && <MarkContacted agencyId={agency.id} leadId={l.id} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
