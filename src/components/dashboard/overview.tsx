import { Lock, Star } from "lucide-react";
import Link from "next/link";

import { AgencyLogo } from "@/components/agency-logo";
import { MarkContacted } from "@/components/dashboard/mark-contacted";
import { Paywall } from "@/components/dashboard/paywall";
import { BadgeCode } from "@/components/dashboard/badge-code";
import { badgeCode, card, cardSub, cardTitle, linkCls } from "@/components/dashboard/ui";
import { UpgradeDialog } from "@/components/dashboard/upgrade-dialog";
import { SeoHiddenNotice } from "@/components/seo-hidden-notice";
import { openBillingPortal } from "@/lib/actions/billing";
import { profileFormProps } from "@/lib/agency-profile";
import { COMPANY } from "@/lib/company";
import { agencyActivity, demandFor, strengthInput, type DemandRow } from "@/lib/data/agency-stats";
import { getAgencyBySlug, getResponseTimes, getSimilarAgencies } from "@/lib/data/agencies";
import type { DashboardContext } from "@/lib/data/dashboard";
import { responseLabel } from "@/lib/pricing";
import { profileStrength } from "@/lib/profile-strength";
import { CONTACT_EMAIL } from "@/lib/site";
import { cn } from "@/lib/utils";
import { BUDGET_RANGES } from "@/lib/validation/lead";

// Overview (docs/mockups/agency-dashboard.html, without Founding). Real numbers only: anything
// without data is left out, and what's locked says what Pro unlocks instead of showing a number.

const count = new Intl.NumberFormat("en-US");
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
const ago = (iso: string) => {
  const h = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  return h < 1
    ? "Just now"
    : h < 24
      ? `${h} hour${h === 1 ? "" : "s"} ago`
      : `${Math.round(h / 24)} days ago`;
};
const delta = (now: number, before: number) =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;
const STRENGTH_HREF = { profile: "profile", channels: "channels", "case-studies": "case-studies" };

export async function Overview({ ctx }: { ctx: DashboardContext }) {
  const { agency, supabase, e, live, pro } = ctx;
  const base = `/dashboard/${agency.slug}`;

  const [tags, activity, form, strength, responses, public_] = await Promise.all([
    supabase
      .from("agencies")
      .select("agency_services(services(slug)), agency_industries(industries(slug))")
      .eq("id", agency.id)
      .single(),
    agencyActivity(agency.id),
    profileFormProps(supabase, agency),
    strengthInput(agency.id).then(profileStrength),
    getResponseTimes(),
    agency.status === "published" ? getAgencyBySlug(agency.slug) : null,
  ]);
  const demand = tags.data
    ? await demandFor({
        id: agency.id,
        services: tags.data.agency_services.map((s) => s.services),
        industries: tags.data.agency_industries.map((i) => i.industries),
      })
    : [];

  const viewsDelta = delta(activity.views, activity.viewsBefore);
  const proProps = {
    agencyId: agency.id,
    agencyUrl: pro.agencyUrl,
    monthly: pro.monthly,
    yearly: pro.yearly,
    saving: pro.saving,
    live: pro.checkout,
    from: "billing" as const,
    refundDays: COMPANY.refunds.yearlyFullRefundDays,
  };
  const seeProCls =
    "border-0 bg-transparent p-0 text-[12.5px] font-semibold text-accent hover:underline";

  // Not on Pro: the paywall, plus what's real and free to see.
  if (!e.managed) {
    const similar = public_ ? await getSimilarAgencies(public_, 3) : [];
    return (
      <div className="flex flex-col gap-4">
        <SeoHiddenNotice
          profile={form.defaults}
          className="rounded-2xl bg-(--amber-soft) px-[18px] py-4 text-[15px] text-text"
        />
        <Paywall ctx={ctx} />
        <section
          aria-label="Last 30 days"
          className="grid overflow-hidden rounded-[18px] border border-line bg-raised tabular-nums sm:grid-cols-2 lg:grid-cols-4"
        >
          <Stat
            label="Profile views"
            hint="30 days"
            value={count.format(activity.views)}
            delta={viewsDelta}
          />
          {[
            ["Visitors sent to your site", "Pro adds a link to your website."],
            ["Inquiries", "Pro turns on your contact form."],
            ["Reply time", "Shown on your profile with Pro."],
          ].map(([label, note]) => (
            <div
              key={label}
              className="border-b border-line-2 px-5 py-[18px] last:border-0 sm:border-r lg:border-b-0"
            >
              <p className="text-[13px] text-text-2">{label}</p>
              <p className="mt-2 flex items-start gap-1.5 text-[13.5px] text-text-2">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  {note} <UpgradeDialog {...proProps} label="See Pro" className={seeProCls} />
                </span>
              </p>
            </div>
          ))}
        </section>
        <div className="grid gap-4 min-[1000px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {demand.length > 0 ? <Demand rows={demand} base={base} /> : <div />}
          {similar.length > 0 && (
            <section aria-labelledby="rivals-h" className={card}>
              <h2 id="rivals-h" className={cardTitle}>
                Other agencies on your profile
              </h2>
              <p className={cardSub}>
                {similar.length} similar {similar.length === 1 ? "agency is" : "agencies are"} shown
                to everyone who views your profile, with a button to contact them instead.
              </p>
              <ul className="mt-3 grid gap-2">
                {similar.map((a) => (
                  <li key={a.id} className="flex items-center gap-2.5 text-[14px]">
                    <AgencyLogo name={a.name} logoPath={a.logoPath} />
                    <Link
                      href={`/agency/${a.slug}`}
                      className="min-w-0 truncate font-medium hover:underline"
                    >
                      {a.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[13.5px] text-text-2">Pro removes them from your profile.</p>
            </section>
          )}
        </div>
      </div>
    );
  }

  // On Pro: the full overview.
  const response = responses.get(agency.id);
  const replies = responseLabel(response?.medianMinutes ?? null);
  const [{ data: leads }, verification] = await Promise.all([
    supabase
      .from("lead_routes")
      .select("sent_at, contacted_at, leads(id, name, company, budget_range, services(name))")
      .eq("agency_id", agency.id)
      .order("sent_at", { ascending: false })
      .limit(3),
    supabase
      .from("verifications")
      .select("status")
      .eq("agency_id", agency.id)
      .in("status", ["requested", "approved"]),
  ]);
  const waiting = (leads ?? []).filter((l) => !l.contacted_at).length;
  const verified = verification.data?.some((v) => v.status === "approved") ?? false;
  const inReview = verification.data?.some((v) => v.status === "requested") ?? false;
  const spot = demand.find((r) => r.spot !== null && r.openSlot);

  return (
    <div className="flex flex-col gap-4">
      <SeoHiddenNotice
        profile={form.defaults}
        className="rounded-2xl bg-(--amber-soft) px-[18px] py-4 text-[15px] text-text"
      />
      <section
        aria-label="Last 30 days"
        className="grid overflow-hidden rounded-[18px] border border-line bg-raised tabular-nums sm:grid-cols-2 lg:grid-cols-4"
      >
        <Stat
          label="Profile views"
          hint="30 days"
          value={count.format(activity.views)}
          delta={viewsDelta}
        />
        <Stat
          label="Visitors sent to your site"
          value={count.format(activity.clicks)}
          delta={delta(activity.clicks, activity.clicksBefore)}
        />
        <Stat
          label="Inquiries"
          value={count.format(activity.inquiries)}
          note={waiting ? `${waiting} waiting for a reply` : undefined}
        />
        {replies ? (
          <Stat
            label="Reply time"
            value={replies.replace("Usually replies ", "").replace(/^w/, "W")}
            small
            note="Shown on your profile"
          />
        ) : (
          <div className="px-5 py-[18px]">
            <p className="text-[13px] text-text-2">Reply time</p>
            <p className="mt-2 text-[13.5px] text-text-2">
              Shows once you&apos;ve marked 3 inquiries as contacted.
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-4 min-[1000px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {demand.length > 0 && <Demand rows={demand} base={base} />}
          <section aria-labelledby="inq-h" className={card}>
            <div className="mb-3.5 flex items-start justify-between gap-3">
              <div>
                <h2 id="inq-h" className={cardTitle}>
                  Latest inquiries
                </h2>
                <p className={cardSub}>
                  Mark them as contacted to show your reply time on your profile.
                </p>
              </div>
              <Link
                href={`${base}/inquiries`}
                className={cn(linkCls, "text-[14px] whitespace-nowrap")}
              >
                All inquiries
              </Link>
            </div>
            {leads && leads.length > 0 ? (
              <ul>
                {leads.map((l) =>
                  l.leads ? (
                    <li
                      key={l.leads.id}
                      className="flex flex-wrap items-center gap-3.5 border-b border-line-2 py-3 last:border-0"
                    >
                      <span
                        aria-hidden
                        className="grid size-9 place-items-center rounded-full bg-surface text-[13px] font-[650]"
                      >
                        {(l.leads.company || l.leads.name).slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <b className="block truncate text-[14.5px]">
                          {l.leads.company || l.leads.name}
                        </b>
                        <span className="text-[13px] text-text-2">
                          {[
                            l.leads.services?.name ?? "Direct message",
                            BUDGET_RANGES.find((b) => b.value === l.leads!.budget_range)?.label,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                      <div className="ml-auto text-right text-[12.5px]">
                        {l.contacted_at ? (
                          <span className="font-semibold text-(--mint)">Contacted</span>
                        ) : (
                          <>
                            <span className="text-text-2 tabular-nums">{ago(l.sent_at)}</span>
                            <MarkContacted agencyId={agency.id} leadId={l.leads.id} />
                          </>
                        )}
                      </div>
                    </li>
                  ) : null,
                )}
              </ul>
            ) : (
              <p className="text-[14px] text-text-2">
                No inquiries yet. They arrive here and in your email when a business contacts you or
                we match them with you.
              </p>
            )}
          </section>
        </div>

        <div className="grid content-start gap-4">
          <section aria-labelledby="strength-h" className={card}>
            <div className="flex items-baseline justify-between">
              <h2 id="strength-h" className={cardTitle}>
                Profile strength
              </h2>
              <b className="text-[28px] font-[650] tracking-[-0.02em] tabular-nums">
                {strength.percent}%
              </b>
            </div>
            <div
              role="progressbar"
              aria-label="Profile strength"
              aria-valuenow={strength.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1 mb-1.5 h-2.5 overflow-hidden rounded-full bg-surface"
            >
              <i
                className="block h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--violet))]"
                style={{ width: `${strength.percent}%` }}
              />
            </div>
            <p className={cardSub}>Complete profiles rank higher and get more inquiries.</p>
            <ul className="mt-3.5">
              {strength.items.map((i) => (
                <li
                  key={i.key}
                  className="flex items-center gap-2.5 border-b border-line-2 py-[9px] text-[14px] last:border-0"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border-[1.5px]",
                      i.done ? "border-(--mint) bg-(--mint) text-white" : "border-line",
                    )}
                  >
                    {i.done && "✓"}
                  </span>
                  {i.done ? (
                    <span className="text-text-2 line-through">
                      <span className="sr-only">Done: </span>
                      {i.label}
                    </span>
                  ) : (
                    <>
                      <Link
                        href={`${base}/${STRENGTH_HREF[i.section]}`}
                        className="hover:underline"
                      >
                        {i.label}
                      </Link>
                      <span className="ml-auto text-[12.5px] font-semibold whitespace-nowrap text-(--mint)">
                        +{i.gain}%
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {live && (
            <section aria-labelledby="plan-h" className={card}>
              <h2 id="plan-h" className={cardTitle}>
                Pro
                {live.billing_interval
                  ? `, ${live.billing_interval === "year" ? "yearly" : "monthly"}`
                  : ""}
              </h2>
              <p className={cardSub}>
                {live.status === "past_due"
                  ? "Your last payment didn't go through. Update your card to keep Pro."
                  : live.ends_at
                    ? live.cancel_at_period_end || live.source !== "payment"
                      ? `Ends on ${longDate(live.ends_at)}.`
                      : `Renews on ${longDate(live.ends_at)}.`
                    : "No end date."}
              </p>
              {live.source === "payment" ? (
                <form action={openBillingPortal.bind(null, agency.id)} className="mt-2.5">
                  <button type="submit" className={cn(linkCls, "text-[14px]")}>
                    Manage billing
                  </button>
                </form>
              ) : (
                <Link
                  href={`${base}/billing`}
                  className={cn(linkCls, "mt-2.5 inline-block text-[14px]")}
                >
                  Plan details
                </Link>
              )}
            </section>
          )}

          {spot && (
            <section aria-labelledby="spot-h" className={card}>
              <div className="flex items-start gap-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--amber-soft) text-(--amber-on-soft)">
                  <Star className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 id="spot-h" className={cardTitle}>
                    A top spot is open
                  </h2>
                  <p className={cardSub}>
                    A sponsored position on &ldquo;{spot.label}&rdquo; (
                    {count.format(spot.visitors)} visitors in the last 30 days) is free.
                    {!verified && " Sponsoring needs the Verified badge."}
                  </p>
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Sponsoring ${spot.label}`)}`}
                    className={cn(linkCls, "mt-2.5 inline-block text-[14px]")}
                  >
                    Ask about sponsoring
                  </a>
                </div>
              </div>
            </section>
          )}

          <section aria-labelledby="verify-h" className={card}>
            <h2 id="verify-h" className={cardTitle}>
              {verified ? "You're verified" : inReview ? "Verification in review" : "Get verified"}
            </h2>
            <p className={cardSub}>
              {verified
                ? "The Verified badge shows on your profile and in the directory."
                : inReview
                  ? "We're checking your channels, website and business, and will email you."
                  : "Verified agencies get a badge and rank higher. It can't be bought."}
            </p>
            {!verified && !inReview && (
              <Link
                href={`${base}/verification`}
                className={cn(linkCls, "mt-2.5 inline-block text-[14px]")}
              >
                Ask to be verified
              </Link>
            )}
          </section>

          {agency.status === "published" && (
            <section aria-labelledby="badge-h" className={card}>
              <h2 id="badge-h" className={cardTitle}>
                Show it on your website
              </h2>
              <p className={cardSub}>Add the badge to your site so clients can see your profile.</p>
              <BadgeCode code={badgeCode(agency.slug)} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  hint,
  value,
  delta,
  note,
  small = false,
}: {
  label: string;
  hint?: string;
  value: string;
  delta?: number | null;
  note?: string;
  small?: boolean;
}) {
  return (
    <div className="min-w-0 border-b border-line-2 px-5 py-[18px] last:border-0 sm:border-r lg:border-b-0">
      <p className="flex justify-between gap-2 text-[13px] text-text-2">
        <span>{label}</span>
        {hint && <span>{hint}</span>}
      </p>
      <p
        className={cn(
          "mt-1.5 leading-[1.1] font-[650] tracking-[-0.025em]",
          small ? "mt-3 text-[22px]" : "text-[30px]",
        )}
      >
        {value}
      </p>
      {delta != null && (
        <p
          className={cn(
            "mt-1 text-[12.5px]",
            delta >= 0 ? "font-semibold text-(--mint)" : "text-text-2",
          )}
        >
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% vs the 30 days before
        </p>
      )}
      {note && <p className="mt-1 text-[12.5px] text-text-2">{note}</p>}
    </div>
  );
}

function Demand({ rows, base }: { rows: DemandRow[]; base: string }) {
  const missing = rows.find((r) => r.spot === null && r.missingIndustry);
  return (
    <section aria-labelledby="demand-h" className={card}>
      <h2 id="demand-h" className={cardTitle}>
        Where businesses are looking
      </h2>
      <p className={cardSub}>
        The busiest directory pages for your services in the last 30 days, and where you appear on
        them.
      </p>
      <div className="mt-3.5 overflow-x-auto">
        <table className="w-full border-collapse text-[14px] tabular-nums">
          <thead>
            <tr className="border-b border-line-2 text-left text-[12px] text-text-2">
              <th scope="col" className="pb-2 font-medium">
                Page
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Visitors
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Agencies
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Your spot
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.path} className="border-b border-line-2 last:border-0">
                <td className="py-3 pr-3">
                  <Link href={r.path} className="hover:text-accent">
                    {r.label}
                  </Link>
                </td>
                <td className="py-3 text-right">{count.format(r.visitors)}</td>
                <td className="py-3 text-right">{r.agencies}</td>
                <td className="py-3 text-right">
                  <span
                    className={cn(
                      "inline-flex h-[22px] items-center rounded-full px-2 text-[12px] font-semibold whitespace-nowrap",
                      r.spot === null
                        ? "bg-(--accent-soft) text-(--accent-on-soft)"
                        : r.spot <= 3
                          ? "bg-(--mint-soft) text-(--mint)"
                          : "bg-surface",
                    )}
                  >
                    {r.spot === null ? "Not listed" : `#${r.spot}`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {missing && (
        <p className={cn(cardSub, "mt-3")}>
          You don&apos;t list {missing.missingIndustry} as an industry.{" "}
          <Link href={`${base}/profile`} className={linkCls}>
            Add it
          </Link>{" "}
          if you work with {missing.missingIndustry!.toLowerCase()} brands.
        </p>
      )}
    </section>
  );
}
