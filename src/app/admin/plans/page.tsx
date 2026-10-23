import Link from "next/link";

import { ChangePlanButton } from "@/components/admin/change-plan-button";
import { Empty, PLAN_LABEL, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatCount, formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Plans" };

// "free" = unmanaged: listed, no live Pro subscription.
const TABS = ["pro", "free"] as const;
const SOURCE: Record<string, string> = {
  manual: "Manual",
  founding: "Founding (now Pro)",
  payment: "Payment",
};
const PER_PAGE = 50;
// Lemon Squeezy dashboard; search Subscriptions for the subscription id shown here.
const LS_DASHBOARD = "https://app.lemonsqueezy.com";
const EVENT_LABEL: Record<string, string> = {
  "checkout.completed": "Checkout completed",
  "subscription.active": "Subscription active",
  "subscription.paid": "Payment received",
  "subscription.update": "Subscription updated",
  "subscription.scheduled_cancel": "Cancel scheduled",
  "subscription.past_due": "Payment failed",
  "subscription.unpaid": "Unpaid",
  "subscription.canceled": "Cancelled",
  "subscription.expired": "Expired",
  "refund.created": "Refund",
};

export default async function AdminPlansPage({ searchParams }: PageProps<"/admin/plans">) {
  await requireAdmin("/admin/plans");
  const raw = (await searchParams).plan;
  const tab = TABS.find((t) => t === raw) ?? "pro";
  const db = createAdminClient();
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86_400_000).toISOString();

  const [counts, expiring, rows, events] = await Promise.all([
    Promise.all(
      TABS.map((p) =>
        db.from("admin_agency_list").select("id", { count: "exact", head: true }).eq("plan", p),
      ),
    ),
    db
      .from("agency_subscriptions")
      .select("id, agency_id, plan_id, ends_at, agencies(name)")
      .eq("status", "active")
      .gt("ends_at", now.toISOString())
      .lte("ends_at", in30)
      .order("ends_at"),
    tab === "free"
      ? db
          .from("admin_agency_list")
          .select("id, name, status")
          .eq("plan", "free")
          .order("name")
          .limit(PER_PAGE)
      : db
          .from("agency_subscriptions")
          .select(
            "id, agency_id, plan_id, status, starts_at, ends_at, source, external_id, cancel_at_period_end, billing_interval, agencies(name, status)",
          )
          .in("status", ["active", "past_due"])
          .eq("plan_id", tab)
          .lte("starts_at", now.toISOString())
          .or(`ends_at.is.null,ends_at.gt.${now.toISOString()},status.eq.past_due`)
          .order("starts_at", { ascending: false }),
    // Latest Lemon Squeezy events, for the "Last billing event" column.
    db
      .from("billing_events")
      .select("agency_id, type, received_at")
      .not("agency_id", "is", null)
      .order("received_at", { ascending: false })
      .limit(500),
  ]);
  if (counts.some((c) => c.error) || expiring.error || rows.error || events.error)
    throw new Error("Couldn't load plans");
  const lastEvent = new Map<string, { type: string; received_at: string }>();
  for (const ev of events.data) if (!lastEvent.has(ev.agency_id!)) lastEvent.set(ev.agency_id!, ev);
  const countOf = (p: (typeof TABS)[number]) => counts[TABS.indexOf(p)].count ?? 0;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex max-w-reading flex-col gap-1">
        <h1 className="text-admin-title">Plans</h1>
        <p className="text-text-2">
          Listings are free; managing one needs Pro. Agencies buy Pro through Lemon Squeezy (source Payment)
          once payments are on; you can still grant it by hand (Change plan, source Manual), e.g.
          after a Pro request in the Inbox. When Pro ends, the listing stays public but unmanaged:
          no contact form, editing locked. Ending a paid plan here doesn&apos;t cancel it in Lemon Squeezy:
          cancel or refund it in the Lemon Squeezy dashboard too.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {TABS.map((p) => (
          <div key={p} className="flex flex-col gap-1 bg-bg p-5">
            <dt className="text-text-2">{PLAN_LABEL[p]}</dt>
            <dd className="text-admin-kpi">{formatCount(countOf(p))}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="expiring" className="flex flex-col gap-4">
        <h2 id="expiring" className="text-admin-section">
          Ending in the next 30 days
        </h2>
        {expiring.data.length === 0 ? (
          <p className="text-text-2">No Pro subscriptions end in the next 30 days.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {expiring.data.map((s) => (
              <li key={s.id} className="flex h-11 items-center gap-3 px-4">
                <Link
                  href={`/admin/agencies/${s.agency_id}?tab=plan`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {s.agencies?.name ?? "Deleted agency"}
                </Link>
                <span className="text-text-2">{PLAN_LABEL[s.plan_id]}</span>
                <span className="w-28 shrink-0 text-right text-text-2 num">
                  Ends {formatDate(s.ends_at!)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="by-plan" className="flex flex-col gap-4">
        <h2 id="by-plan" className="sr-only">
          Agencies by plan
        </h2>
        <nav
          aria-label="Plan"
          className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line"
        >
          {TABS.map((p) => (
            <Link
              key={p}
              href={`/admin/plans?plan=${p}`}
              aria-current={p === tab ? "page" : undefined}
              className="-mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-text-2 transition-colors duration-150 hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text"
            >
              {PLAN_LABEL[p]}
              <span className="text-[12px] text-text-2 num">{formatCount(countOf(p))}</span>
            </Link>
          ))}
        </nav>

        {tab === "free" ? (
          rows.data.length === 0 ? (
            <Empty>No unmanaged agencies.</Empty>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">Agency</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(rows.data as { id: string; name: string; status: string }[]).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/agencies/${a.id}?tab=plan`} className="hover:underline">
                          {a.name}
                        </Link>
                      </td>
                      <td className="text-text-2 capitalize">{a.status}</td>
                      <td className="text-right">
                        <ChangePlanButton agencyId={a.id} agencyName={a.name} currentPlan="free" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {countOf("free") > PER_PAGE && (
                <p className="text-admin-meta">
                  Showing the first {PER_PAGE} alphabetically. Use Agencies with the Plan filter to
                  find the rest.
                </p>
              )}
            </>
          )
        ) : rows.data.length === 0 ? (
          <Empty
            action={{ href: "/admin/plans?plan=free", label: "Grant Pro to an unmanaged agency" }}
          >
            No agencies on {PLAN_LABEL[tab]} yet.
          </Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th scope="col">Agency</th>
                <th scope="col">Started</th>
                <th scope="col">Ends</th>
                <th scope="col">Source</th>
                <th scope="col">Last billing event</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(
                rows.data as {
                  id: string;
                  agency_id: string;
                  status: string;
                  starts_at: string;
                  ends_at: string | null;
                  source: string;
                  external_id: string | null;
                  cancel_at_period_end: boolean;
                  billing_interval: string | null;
                  agencies: { name: string; status: string } | null;
                }[]
              ).map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/admin/agencies/${s.agency_id}?tab=plan`}
                      className="hover:underline"
                    >
                      {s.agencies?.name ?? "Deleted agency"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap num">{formatDate(s.starts_at)}</td>
                  <td className="whitespace-nowrap text-text-2 num">
                    {s.status === "past_due"
                      ? "Past due"
                      : s.ends_at
                        ? `${s.cancel_at_period_end ? "Ends" : s.source === "payment" ? "Renews" : "Ends"} ${formatDate(s.ends_at)}`
                        : "No end date"}
                  </td>
                  <td className="text-text-2">
                    {SOURCE[s.source] ?? s.source}
                    {s.billing_interval &&
                      `, ${s.billing_interval === "year" ? "yearly" : "monthly"}`}
                    {s.external_id && (
                      <a
                        href={LS_DASHBOARD}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open the Lemon Squeezy dashboard and search for this subscription"
                        className="block font-mono text-[12px] text-accent hover:underline"
                      >
                        {s.external_id}
                      </a>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-text-2">
                    {(() => {
                      const ev = lastEvent.get(s.agency_id);
                      return ev
                        ? `${EVENT_LABEL[ev.type] ?? ev.type}, ${formatDate(ev.received_at)}`
                        : "None";
                    })()}
                  </td>
                  <td className="text-right">
                    <ChangePlanButton
                      agencyId={s.agency_id}
                      agencyName={s.agencies?.name ?? "this agency"}
                      currentPlan={tab}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
