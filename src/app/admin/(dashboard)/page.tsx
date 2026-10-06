import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { CountUp } from "@/components/admin/dashboard/count-up";
import { LeadsChartLazy } from "@/components/admin/dashboard/leads-chart-lazy";
import { Empty, Pill, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getDashboard } from "@/lib/data/admin-dashboard";
import { formatCount, formatDateTime, formatDelta, formatRelative } from "@/lib/format";
import { PERIODS, parsePeriod } from "@/lib/periods";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const icon = "size-4 shrink-0 text-text-2 [stroke-width:1.5]";

function Ago({ at }: { at: string }) {
  return (
    <time dateTime={at} title={formatDateTime(at)} className="whitespace-nowrap text-text-2 num">
      {formatRelative(at)}
    </time>
  );
}

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin("/admin");
  const period = parsePeriod((await searchParams).period);
  const periodLabel = PERIODS.find((p) => p.id === period)!.label;
  const d = await getDashboard(period);
  const { leads, needsAction, agencies, seo } = d.kpis;
  const hasLeads = d.series.some((p) => p.current > 0);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-admin-title">Dashboard</h1>
        <nav aria-label="Period" className="flex rounded-lg border border-line p-0.5">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={p.id === "30d" ? "/admin" : `/admin?period=${p.id}`}
              aria-current={p.id === period ? "page" : undefined}
              scroll={false}
              className="flex h-8 items-center rounded-md px-3 text-text-2 transition-colors duration-150 hover:text-text aria-[current=page]:bg-surface-2 aria-[current=page]:font-medium aria-[current=page]:text-text"
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        <div className="flex flex-col gap-1 bg-bg p-5">
          <dt className="text-text-2">Leads</dt>
          <dd className="text-admin-kpi">
            <CountUp value={leads.value} />
          </dd>
          <dd className="text-admin-meta num">
            {leads.delta === null
              ? `None in the previous ${periodLabel}`
              : `${formatDelta(leads.delta)} vs previous ${periodLabel}`}
          </dd>
        </div>
        <div className="flex flex-col gap-1 bg-bg p-5">
          <dt className="text-text-2">Needs action</dt>
          <dd className="text-admin-kpi">
            <CountUp value={needsAction.value} />
          </dd>
          <dd className="text-admin-meta">
            {needsAction.oldest ? (
              <Link href={needsAction.oldest.href} className="hover:text-text hover:underline">
                Oldest waiting{" "}
                <span className="num">{formatRelative(needsAction.oldest.since)}</span>
              </Link>
            ) : (
              "Nothing waiting"
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1 bg-bg p-5">
          <dt className="text-text-2">Agencies</dt>
          <dd className="text-admin-kpi">
            <CountUp value={agencies.value} />
          </dd>
          <dd className="text-admin-meta">
            <span className="num">{formatCount(agencies.claimed)}</span> claimed
          </dd>
        </div>
        <div className="flex flex-col gap-1 bg-bg p-5">
          <dt className="text-text-2">SEO pages</dt>
          <dd className="text-admin-kpi">
            <CountUp value={seo.indexable} />
            <span className="text-[18px] font-normal text-text-2 num">
              {" "}
              / {formatCount(seo.total)}
            </span>
          </dd>
          <dd className="text-admin-meta">Combination pages indexed</dd>
        </div>
      </dl>

      <section aria-labelledby="leads-over-time" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="leads-over-time" className="text-admin-section">
            Leads over time
          </h2>
          {hasLeads && (
            <div className="flex items-center gap-4 text-admin-meta" aria-hidden>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-accent" />
                Last {periodLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-text-2 opacity-60" />
                Previous {periodLabel}
              </span>
            </div>
          )}
        </div>
        {hasLeads ? (
          <LeadsChartLazy data={d.series} period={period} />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line px-6 text-center text-text-2">
            No leads in this period yet. They appear here as businesses send requests.
          </div>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="attention" className="flex flex-col gap-4">
          <h2 id="attention" className="text-admin-section">
            Needs your attention
          </h2>
          {d.attention.length === 0 ? (
            <Empty>
              Nothing needs your attention. New submissions, claims and reviews show up here.
            </Empty>
          ) : (
            <div className="flex flex-col divide-y divide-line rounded-xl border border-line">
              {d.attention.map((g) => (
                <div key={g.type} className="flex flex-col py-2">
                  <div className="flex items-center justify-between px-4 py-1.5">
                    <h3 className="font-medium">
                      {g.heading}{" "}
                      <span className="font-normal text-text-2 num">{formatCount(g.total)}</span>
                    </h3>
                    {g.total > g.items.length && (
                      <Link
                        href={g.href}
                        className="text-admin-meta hover:text-text hover:underline"
                      >
                        View all
                      </Link>
                    )}
                  </div>
                  <ul>
                    {g.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="flex h-9 items-center gap-3 px-4 transition-colors duration-150 hover:bg-surface-2"
                        >
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          <Ago at={item.since} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="supply-gaps" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="supply-gaps" className="text-admin-section">
              Supply gaps
            </h2>
            <p className="text-admin-meta">
              Service and industry pages with the most leads per published agency in the last{" "}
              {periodLabel}. Recruit agencies for the top rows.
            </p>
          </div>
          {d.gaps.length === 0 ? (
            <Empty>No leads with a service and industry in this period yet.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th scope="col">Page</th>
                  <th scope="col" className="text-right">
                    Leads
                  </th>
                  <th scope="col" className="text-right">
                    Agencies
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.gaps.map((g) => (
                  <tr key={g.key}>
                    <td>
                      <a
                        href={g.path}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        {g.service} for {g.industry}
                        <ArrowUpRight className={icon} aria-hidden />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </td>
                    <td className="text-right num">{formatCount(g.leads)}</td>
                    <td className="text-right num">{formatCount(g.agencies)}</td>
                    <td>
                      <Pill on={g.indexed}>{g.indexed ? "Indexed" : "Noindex"}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>

        <section aria-labelledby="recent-leads" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="recent-leads" className="text-admin-section">
              Recent leads
            </h2>
            {d.recentLeads.length > 0 && (
              <Link href="/admin/leads" className="text-admin-meta hover:text-text hover:underline">
                All leads
              </Link>
            )}
          </div>
          {d.recentLeads.length === 0 ? (
            <Empty>No leads yet. Requests from Get matched and agency profiles appear here.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Need</th>
                  <th scope="col">Budget</th>
                  <th scope="col">Routed to</th>
                  <th scope="col" className="text-right">
                    Received
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.recentLeads.map((l) => (
                  <tr key={l.id}>
                    <td className="max-w-40 truncate">
                      <Link href={`/admin/leads#lead-${l.id}`} className="hover:underline">
                        {l.name}
                      </Link>
                    </td>
                    <td className="text-text-2">{l.need || "Not given"}</td>
                    <td className="whitespace-nowrap text-text-2">{l.budget ?? "Not given"}</td>
                    <td className="text-text-2">
                      {l.routedTo.length ? l.routedTo.join(", ") : "Not routed"}
                    </td>
                    <td className="text-right">
                      <Ago at={l.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>

        <section aria-labelledby="top-agencies" className="flex flex-col gap-4">
          <h2 id="top-agencies" className="text-admin-section">
            Top agencies
          </h2>
          {d.topAgencies.length === 0 ? (
            <Empty>
              No profile views recorded in the last {periodLabel} yet. Views are counted as visitors
              open agency profiles.
            </Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th scope="col">Agency</th>
                  <th scope="col" className="text-right">
                    Profile views
                  </th>
                  <th scope="col" className="text-right">
                    Inquiries
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.topAgencies.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/admin/agencies/${a.id}`} className="hover:underline">
                        {a.name}
                      </Link>
                    </td>
                    <td className={cn("text-right num", a.views === 0 && "text-text-2")}>
                      {formatCount(a.views)}
                    </td>
                    <td className={cn("text-right num", a.inquiries === 0 && "text-text-2")}>
                      {formatCount(a.inquiries)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}
