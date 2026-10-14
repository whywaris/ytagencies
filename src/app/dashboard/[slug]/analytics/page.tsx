import Link from "next/link";
import { card, cardSub, cardTitle, linkCls } from "@/components/dashboard/ui";
import { dashboardContext } from "@/lib/data/dashboard";

export const metadata = { title: "Analytics" };

const count = new Intl.NumberFormat("en-US");

/** yyyy-mm-dd, n days before today (UTC). */
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export default async function AnalyticsPage({ params }: PageProps<"/dashboard/[slug]/analytics">) {
  // Owner only (404 otherwise); never a 404 for a listing that isn't on Pro.
  const { agency, supabase, e, pro } = await dashboardContext((await params).slug);
  if (!e.managed)
    return (
      <section aria-labelledby="analytics-h" className={`${card} max-w-reading`}>
        <h2 id="analytics-h" className={cardTitle}>
          Upgrade to Pro to see analytics
        </h2>
        <p className={cardSub}>
          Profile views, visitors sent to your website and inquiries, with 12 months of history. Pro
          is ${pro.monthly} a month or ${pro.yearly} a year.
        </p>
        <Link
          href={`/dashboard/${agency.slug}/billing`}
          className={`${linkCls} mt-3 inline-block text-[14px]`}
        >
          Get Pro
        </Link>
      </section>
    );

  // §6: analytics limited to the plan's history window. Owners read their own rollups (RLS).
  const events = await supabase
    .from("agency_event_daily")
    .select("type, source, count")
    .eq("agency_id", agency.id)
    .gte("day", daysAgo(e.analyticsDays));
  if (events.error) throw new Error("Couldn't load analytics");
  const totals = { profile_view: 0, website_click: 0, inquiry: 0 };
  // Website clicks by where the link was (utm_content, lib/outbound.ts).
  const bySource = { profile: 0, directory: 0, home_hero: 0, guide: 0 };
  for (const r of events.data) {
    if (r.type in totals) totals[r.type as keyof typeof totals] += r.count;
    if (r.type === "website_click" && r.source in bySource)
      bySource[r.source as keyof typeof bySource] += r.count;
  }
  const window = e.analyticsDays >= 365 ? "12 months" : "30 days";

  return (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="analytics" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 id="analytics" className="text-h2">
            Analytics
          </h2>
          <p className="text-text-2">Last {window}. Each visitor counts once a day.</p>
        </div>
        <dl className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          {(
            [
              ["Profile views", totals.profile_view],
              ["Visitors sent to your website", totals.website_click],
              ["Inquiries", totals.inquiry],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 bg-bg p-5">
              <dt className="text-text-2">{label}</dt>
              <dd className="text-h2 tabular-nums">{count.format(value)}</dd>
            </div>
          ))}
        </dl>
        {e.websiteLink ? (
          <div className="flex max-w-reading flex-col gap-3">
            <h3 className="text-h3">Visitors sent to your website</h3>
            <dl className="flex flex-col divide-y divide-line rounded-lg border border-line">
              {(
                [
                  ["From your profile", bySource.profile],
                  ["From directory pages", bySource.directory],
                  ["From the home page", bySource.home_hero],
                  ["From guides", bySource.guide],
                ] as const
              )
                // Your profile always; the other places only once they've sent someone.
                .filter(([label, n]) => n > 0 || label === "From your profile")
                .map(([label, n]) => (
                  <div
                    key={label}
                    className="flex min-h-11 items-center justify-between gap-4 px-4 py-2"
                  >
                    <dt className="text-text-2">{label}</dt>
                    <dd className="tabular-nums">{count.format(n)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        ) : (
          <p className="text-small">
            Visitors to your website start counting once your profile links to it, on{" "}
            <Link
              href={`/dashboard/${agency.slug}/billing`}
              className="text-accent hover:underline"
            >
              Pro
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
