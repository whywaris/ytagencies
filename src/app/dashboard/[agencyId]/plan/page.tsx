import Link from "next/link";
import { notFound } from "next/navigation";

import { RequestVerification } from "@/components/dashboard/request-verification";
import { RequestProForm } from "@/components/forms/request-pro-form";
import { getOwnedAgency } from "@/lib/auth";
import { paymentsEnabled } from "@/lib/billing";
import { getEntitlements } from "@/lib/data/entitlements";
import { absoluteUrl } from "@/lib/site";

export const metadata = { title: "Plan and analytics" };

const count = new Intl.NumberFormat("en-US");

/** yyyy-mm-dd, n days before today (UTC). */
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export default async function PlanPage({ params }: PageProps<"/dashboard/[agencyId]/plan">) {
  const owned = await getOwnedAgency((await params).agencyId);
  if (!owned) notFound();
  const { agency, supabase } = owned;
  const e = await getEntitlements(agency.id);

  // §6: analytics limited to the plan's history window. Owners read their own rollups (RLS).
  const [events, verifications, subscription] = await Promise.all([
    supabase
      .from("agency_event_daily")
      .select("type, source, count")
      .eq("agency_id", agency.id)
      .gte("day", daysAgo(e.analyticsDays)),
    supabase
      .from("verifications")
      .select("status")
      .eq("agency_id", agency.id)
      .in("status", ["requested", "approved"]),
    supabase
      .from("agency_subscriptions")
      .select("ends_at, cancel_at_period_end, status")
      .eq("agency_id", agency.id)
      .in("status", ["active", "past_due"])
      .maybeSingle(),
  ]);
  if (events.error || verifications.error) throw new Error("Couldn't load your plan");
  const totals = { profile_view: 0, website_click: 0, inquiry: 0 };
  // Website clicks by where the link was (utm_content, lib/outbound.ts).
  const bySource = { profile: 0, directory: 0, home_hero: 0, guide: 0 };
  for (const r of events.data) {
    if (r.type in totals) totals[r.type as keyof typeof totals] += r.count;
    if (r.type === "website_click" && r.source in bySource)
      bySource[r.source as keyof typeof bySource] += r.count;
  }
  const approved = verifications.data.some((v) => v.status === "approved");
  const requested = verifications.data.some((v) => v.status === "requested");
  const sub = e.managed ? subscription.data : null;
  const endsAt = sub?.ends_at ?? null;
  const window = e.analyticsDays >= 365 ? "12 months" : "30 days";

  const yes = (b: boolean) => (b ? "Yes" : "No");
  const includes: [string, string][] = [
    ["Edit your listing", yes(e.canEdit)],
    ["Contact form and inquiries", yes(e.contactForm)],
    ["Requests from Get matched", yes(e.managed)],
    ["Link to your website", e.websiteLink ? "Yes, tagged so you can track visits" : "No"],
    [
      "Placement on directory pages",
      e.listTier === "managed" ? "Above unmanaged agencies" : "Below managed agencies",
    ],
    ["Other agencies suggested on your profile", yes(e.showSimilarAgencies)],
    ["Analytics history", window],
  ];
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

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
            <p className="text-small">
              In Google Analytics these visits appear as source ytagencies, medium referral.
            </p>
          </div>
        ) : (
          <p className="text-small">
            Visitors to your website start counting once your profile links to it, on Pro.
          </p>
        )}
      </section>

      <section aria-labelledby="plan" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 id="plan" className="text-h2">
            {e.managed ? "Your plan: Pro" : "Your listing is unmanaged"}
          </h2>
          <p className="text-text-2">
            {!e.managed
              ? "Your profile stays public with the details we hold, but businesses can't contact you and editing is locked. Pro is $29 a month or $279 a year."
              : sub?.status === "past_due"
                ? "Your last payment didn't go through. Pro stays on for 7 days while we retry it."
                : endsAt
                  ? sub?.cancel_at_period_end
                    ? `Cancelled. Pro stays on until ${fmt(endsAt)}.`
                    : `Until ${fmt(endsAt)}.`
                  : "No end date."}
          </p>
        </div>
        <dl className="flex max-w-reading flex-col divide-y divide-line rounded-lg border border-line">
          {includes.map(([k, v]) => (
            <div key={k} className="flex min-h-11 items-center justify-between gap-4 px-4 py-2">
              <dt className="text-text-2">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
        {!e.managed && (
          <div className="flex max-w-reading flex-col gap-3">
            {paymentsEnabled() ? (
              <Link href="/for-agencies/pricing" className="self-start text-accent hover:underline">
                Get Pro
              </Link>
            ) : (
              <RequestProForm agency={absoluteUrl(`/agency/${agency.slug}`)} />
            )}
            <Link href="/for-agencies/pricing" className="self-start text-accent hover:underline">
              What Pro includes
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="verification" className="flex flex-col gap-4">
        <h2 id="verification" className="text-h2">
          Verified badge
        </h2>
        {approved ? (
          <p>Your agency is verified. The badge shows on your profile and in the directory.</p>
        ) : requested ? (
          <p className="max-w-reading">
            Your request is in review. We check your channels, your website and your business, and
            email you when it&apos;s decided.
          </p>
        ) : (
          <>
            <p className="max-w-reading text-text-2">
              We check your YouTube channels, your website domain and that your business is real.
              Any agency can ask, managed or not.
            </p>
            <RequestVerification agencyId={agency.id} />
          </>
        )}
      </section>
    </div>
  );
}
