import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgencyForm } from "@/components/admin/agency-form";
import { AgencyHeaderActions } from "@/components/admin/agency-header-actions";
import { Empty, PLAN_LABEL, PlanBadge, StatusBadge, Table } from "@/components/admin/ui";
import { ChannelTable } from "@/components/admin/channel-table";
import { AgencyLogo } from "@/components/agency-logo";
import { CaseStudies } from "@/components/dashboard/case-studies";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { SeoHiddenNotice } from "@/components/seo-hidden-notice";
import { adminUpdateProfile } from "@/lib/actions/admin";
import { adminDeleteCaseStudy, adminSaveCaseStudy } from "@/lib/actions/admin-directory";
import { hqLocationOptions } from "@/lib/admin-locations";
import { profileFormProps } from "@/lib/agency-profile";
import { requireAdmin } from "@/lib/auth";
import { getEntitlements } from "@/lib/data/entitlements";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { isManaged } from "@/lib/entitlements";
import { formatCount, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { TEAM_SIZES, type AgencyInput } from "@/lib/validation/admin";
import { jsonToMetrics } from "@/lib/validation/dashboard";
import type { StatsSnapshot } from "@/lib/youtube";

export const metadata = { title: "Edit agency" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "case-studies", label: "Case studies" },
  { id: "plan", label: "Plan & billing" },
  { id: "verification", label: "Verification" },
  { id: "leads", label: "Leads" },
  { id: "activity", label: "Activity" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function AdminAgencyPage({
  params,
  searchParams,
}: PageProps<"/admin/agencies/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/agencies/${id}`);
  if (!UUID.test(id)) notFound();
  const rawTab = (await searchParams).tab;
  const tab: TabId = TABS.find((t) => t.id === rawTab)?.id ?? "profile";

  const db = createAdminClient();
  const [{ data: agency }, subs] = await Promise.all([
    db
      .from("agencies")
      .select(
        "id, name, slug, tagline, website, logo_path, founded_year, team_size, languages, status, is_verified, is_claimed, owner_id, description, min_budget_usd, pricing_model, min_contract, ad_spend, setup_fee_usd, seo_title, seo_description, hq_other, locations!agencies_hq_location_id_fkey(slug)",
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("agency_subscriptions")
      .select(
        "id, plan_id, status, starts_at, ends_at, source, created_at, cancel_at_period_end, past_due_since",
      )
      .eq("agency_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!agency) notFound();
  if (subs.error) throw new Error("Couldn't load the plan");
  // "pro" while managed, "free" (shown as Unmanaged) otherwise.
  const plan = isManaged(subs.data) ? "pro" : "free";
  const owner = agency.owner_id ? await db.auth.admin.getUserById(agency.owner_id) : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <AgencyLogo name={agency.name} logoPath={agency.logo_path} size="sm" />
          <div className="flex flex-col gap-1">
            <h1 className="text-admin-title">{agency.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-text-2">
              <StatusBadge status={agency.status} />
              <PlanBadge plan={plan} />
              {agency.is_verified && (
                <span className="inline-flex items-center gap-1 text-success">
                  <BadgeCheck className="size-4 [stroke-width:1.5]" aria-hidden />
                  Verified
                </span>
              )}
              <span>
                {owner?.data.user?.email ??
                  (agency.is_claimed ? "Claimed, account removed" : "Unclaimed")}
              </span>
            </div>
          </div>
        </div>
        <AgencyHeaderActions
          agency={{
            id: agency.id,
            name: agency.name,
            slug: agency.slug,
            status: agency.status,
            plan,
          }}
        />
      </header>

      <nav
        aria-label="Agency sections"
        className="-mt-2 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={
              t.id === "profile" ? `/admin/agencies/${id}` : `/admin/agencies/${id}?tab=${t.id}`
            }
            aria-current={t.id === tab ? "page" : undefined}
            className="-mb-px flex h-10 shrink-0 items-center border-b-2 border-transparent px-3 text-text-2 transition-colors duration-150 hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text"
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "profile" && <ProfileTab agency={agency} />}
      {tab === "case-studies" && <CaseStudiesTab agencyId={id} />}
      {tab === "plan" && <PlanTab agencyId={id} subs={subs.data} plan={plan} />}
      {tab === "verification" && <VerificationTab agencyId={id} />}
      {tab === "leads" && <LeadsTab agencyId={id} />}
      {tab === "activity" && <ActivityTab agencyId={id} />}
    </div>
  );
}

async function ProfileTab({
  agency,
}: {
  agency: {
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
    website: string | null;
    founded_year: number | null;
    team_size: string | null;
    languages: string[] | null;
    status: string;
    description: string | null;
    min_budget_usd: number | null;
    pricing_model: string | null;
    min_contract: string | null;
    ad_spend: string | null;
    setup_fee_usd: number | null;
    seo_title: string | null;
    seo_description: string | null;
    hq_other: string | null;
    locations: { slug: string } | null;
  };
}) {
  const db = createAdminClient();
  const [locations, form] = await Promise.all([hqLocationOptions(), profileFormProps(db, agency)]);
  const defaults: AgencyInput = {
    name: agency.name,
    slug: agency.slug,
    tagline: agency.tagline ?? "",
    website: agency.website ?? "",
    foundedYear: agency.founded_year?.toString() ?? "",
    teamSize: (TEAM_SIZES as readonly string[]).includes(agency.team_size ?? "")
      ? (agency.team_size as AgencyInput["teamSize"])
      : "",
    languages: (agency.languages ?? []).join(", "),
    seoTitle: agency.seo_title ?? "",
    seoDescription: agency.seo_description ?? "",
    hqLocation: agency.locations?.slug ?? "",
  };
  return (
    <div className="flex flex-col gap-12">
      <SeoHiddenNotice
        profile={form.defaults}
        className="max-w-reading rounded-lg border border-line bg-surface-2 px-4 py-3"
      />
      {agency.hq_other && (
        <p
          role="note"
          className="max-w-reading rounded-lg border border-line bg-surface-2 px-4 py-3"
        >
          Submitted HQ city we don&apos;t list: <strong>{agency.hq_other}</strong>. Add it in
          Taxonomy → Locations if needed, choose it as the HQ below and save; this note then goes
          away.
        </p>
      )}
      <section aria-labelledby="details" className="flex max-w-reading flex-col gap-6">
        <h2 id="details" className="text-admin-section">
          Details
        </h2>
        <AgencyForm
          id={agency.id}
          defaults={defaults}
          locations={locations}
          slugLocked={agency.status === "published"}
        />
      </section>
      <section aria-labelledby="profile" className="flex flex-col gap-6">
        <h2 id="profile" className="text-admin-section">
          Profile, services and locations
        </h2>
        <ProfileForm save={adminUpdateProfile} agencyId={agency.id} {...form} />
      </section>
    </div>
  );
}

async function CaseStudiesTab({ agencyId }: { agencyId: string }) {
  const [caseStudies, industries, services] = await Promise.all([
    createAdminClient()
      .from("case_studies")
      .select("id, title, summary, channel_url, metrics, industries(slug), services(slug)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false }),
    getIndustries(),
    getServices(),
  ]);
  if (caseStudies.error) throw new Error("Couldn't load case studies");
  return (
    <CaseStudies
      actions={{ save: adminSaveCaseStudy, remove: adminDeleteCaseStudy }}
      agencyId={agencyId}
      industries={industries.map(({ slug, name }) => ({ slug, name }))}
      services={services.map(({ slug, name }) => ({ slug, name }))}
      items={caseStudies.data.map((c) => ({
        id: c.id,
        title: c.title,
        industry: c.industries?.slug ?? "",
        service: c.services?.slug ?? "",
        channelUrl: c.channel_url ?? "",
        summary: c.summary ?? "",
        metrics: jsonToMetrics(c.metrics),
      }))}
    />
  );
}

const SOURCE: Record<string, string> = {
  manual: "Manual",
  founding: "Founding (now Pro)",
  payment: "Payment",
};

async function PlanTab({
  agencyId,
  subs,
  plan,
}: {
  agencyId: string;
  subs: {
    id: string;
    plan_id: string;
    status: string;
    starts_at: string;
    ends_at: string | null;
    source: string;
  }[];
  plan: string;
}) {
  const e = await getEntitlements(agencyId);
  const active = subs.find((s) => s.status === "active" || s.status === "past_due");
  const yes = (v: boolean) => (v ? "Yes" : "No");
  const rows: [string, string][] = [
    ["Managed", e.managed ? "Yes (Pro)" : "No (unmanaged)"],
    ["Contact form and inquiries", yes(e.contactForm)],
    ["Owner can edit", yes(e.canEdit)],
    ["Website link on profile", yes(e.websiteLink)],
    ["Response time on profile", yes(e.responseTime)],
    ["Similar agencies on profile", e.showSimilarAgencies ? "Shown" : "Hidden"],
    ["List position", e.listTier === "managed" ? "Above unmanaged" : "Below managed"],
    ["Analytics history", e.analyticsDays >= 365 ? "12 months" : "30 days"],
    ["Can buy Sponsored slots", yes(e.canBuySponsored)],
  ];
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section aria-labelledby="current-plan" className="flex flex-col gap-4">
        <h2 id="current-plan" className="text-admin-section">
          Current plan
        </h2>
        <div className="flex flex-col gap-1">
          <p className="text-[20px] leading-7 font-semibold">{PLAN_LABEL[plan]}</p>
          <p className="text-text-2 num">
            {active && plan !== "free"
              ? active.ends_at
                ? `Since ${formatDate(active.starts_at)}, ends ${formatDate(active.ends_at)}`
                : `Since ${formatDate(active.starts_at)}, no end date`
              : "Unmanaged: no live Pro subscription. Payments are off, so Pro is granted by hand."}
          </p>
        </div>
        <dl className="divide-y divide-line rounded-xl border border-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex h-10 items-center justify-between px-4">
              <dt className="text-text-2">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="plan-history" className="flex flex-col gap-4">
        <h2 id="plan-history" className="text-admin-section">
          History
        </h2>
        {subs.length === 0 ? (
          <Empty>Never had a subscription. Use Change plan to grant Pro.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Status</th>
                <th scope="col">Started</th>
                <th scope="col">Ends</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>{PLAN_LABEL[s.plan_id] ?? s.plan_id}</td>
                  <td className="text-text-2 capitalize">{s.status}</td>
                  <td className="whitespace-nowrap num">{formatDate(s.starts_at)}</td>
                  <td className="whitespace-nowrap text-text-2 num">
                    {s.ends_at ? formatDate(s.ends_at) : "No end date"}
                  </td>
                  <td className="text-text-2">{SOURCE[s.source] ?? s.source}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}

async function VerificationTab({ agencyId }: { agencyId: string }) {
  const { data, error } = await createAdminClient()
    .from("verifications")
    .select("id, status, stats_snapshot, checklist, reviewed_at, created_at")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Couldn't load verifications");
  const approved = data.find((v) => v.status === "approved");
  const requested = data.find((v) => v.status === "requested");
  const snapshot = (approved?.stats_snapshot ?? null) as StatsSnapshot | null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-reading">
          {approved
            ? `Verified since ${formatDate(approved.reviewed_at ?? approved.created_at)}.`
            : requested
              ? `Verification requested ${formatRelative(requested.created_at)}.`
              : "Not verified."}
        </p>
        <Link
          href={`/admin/verification/${agencyId}`}
          className="flex h-9 items-center rounded-lg border border-line px-3 font-medium hover:bg-surface-2"
        >
          {approved ? "Review verification" : "Verify agency"}
        </Link>
      </div>
      {snapshot ? (
        <section aria-labelledby="channels" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="channels" className="text-admin-section">
              Channels
            </h2>
            <p className="text-admin-meta num">
              Checked {formatDate(snapshot.latest.fetchedAt)}, re-checked monthly.{" "}
              {snapshot.history.length > 0 && `${snapshot.history.length} earlier checks kept.`}
            </p>
          </div>
          <ChannelTable channels={snapshot.latest.channels} />
        </section>
      ) : approved ? (
        <Empty>Verified before channel stats were recorded. Re-verify to add them.</Empty>
      ) : null}
    </div>
  );
}

async function LeadsTab({ agencyId }: { agencyId: string }) {
  const { data, error } = await createAdminClient()
    .from("lead_routes")
    .select("sent_at, leads(id, name, email, budget_range, services(name), industries(name))")
    .eq("agency_id", agencyId)
    .order("sent_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Couldn't load leads");
  if (data.length === 0) return <Empty>No leads have been sent to this agency yet.</Empty>;
  return (
    <Table>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Email</th>
          <th scope="col">Need</th>
          <th scope="col" className="text-right">
            Sent
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((r) =>
          r.leads ? (
            <tr key={r.leads.id}>
              <td>
                <Link href={`/admin/leads#lead-${r.leads.id}`} className="hover:underline">
                  {r.leads.name}
                </Link>
              </td>
              <td className="text-text-2">{r.leads.email}</td>
              <td className="text-text-2">
                {[
                  r.leads.services?.name,
                  r.leads.industries?.name && `for ${r.leads.industries.name}`,
                ]
                  .filter(Boolean)
                  .join(" ") || "Contacted directly"}
              </td>
              <td className="text-right">
                <time
                  dateTime={r.sent_at}
                  title={formatDateTime(r.sent_at)}
                  className="text-text-2 num"
                >
                  {formatRelative(r.sent_at)}
                </time>
              </td>
            </tr>
          ) : null,
        )}
      </tbody>
    </Table>
  );
}

const ACTION_LABEL: Record<string, string> = {
  "agency.create": "Created",
  "agency.update": "Edited details",
  "agency.profile_update": "Edited profile",
  "agency.publish": "Published",
  "agency.unpublish": "Unpublished",
  "agency.archive": "Archived",
  "agency.feature": "Marked Featured",
  "agency.unfeature": "Removed Featured",
  "agency.verify": "Verified",
  "agency.unverify": "Removed Verified",
  "review.create": "Added a review",
  "review.update": "Edited a review",
  "agency.change_plan": "Changed plan",
  "submission.approve": "Approved submission",
  "submission.reject": "Rejected submission",
  "verification.approve": "Approved verification",
  "verification.reject": "Rejected verification",
  "verification.revoke": "Revoked verification",
  "case_study.create": "Added a case study",
  "case_study.update": "Edited a case study",
  "case_study.delete": "Deleted a case study",
};

/** yyyy-mm-dd, n days before today (UTC). */
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

async function ActivityTab({ agencyId }: { agencyId: string }) {
  const db = createAdminClient();
  const since = daysAgo(30);
  const [actions, events, routes] = await Promise.all([
    db
      .from("admin_actions")
      .select("id, action, details, created_at, admin_id")
      .eq("entity_type", "agency")
      .eq("entity_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("agency_event_daily").select("type, count").eq("agency_id", agencyId).gte("day", since),
    db
      .from("lead_routes")
      .select("sent_at, contacted_at")
      .eq("agency_id", agencyId)
      .gte("sent_at", daysAgo(90)),
  ]);
  if (actions.error || events.error || routes.error) throw new Error("Couldn't load activity");
  // Replies over 90 days, raw (the public label needs 3+ and under 2 days: agency_response_times).
  const waits = routes.data
    .flatMap((r) =>
      r.contacted_at ? [(Date.parse(r.contacted_at) - Date.parse(r.sent_at)) / 60_000] : [],
    )
    .sort((a, b) => a - b);
  const median =
    waits.length === 0
      ? null
      : waits.length % 2
        ? waits[(waits.length - 1) / 2]
        : (waits[waits.length / 2 - 1] + waits[waits.length / 2]) / 2;
  const totals = { profile_view: 0, website_click: 0, contact_open: 0, inquiry: 0 };
  for (const e of events.data) totals[e.type as keyof typeof totals] += e.count;
  const admins = new Map(
    await Promise.all(
      [...new Set(actions.data.map((a) => a.admin_id).filter((x): x is string => !!x))].map(
        async (uid) =>
          [uid, (await db.auth.admin.getUserById(uid)).data.user?.email ?? null] as const,
      ),
    ),
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section aria-labelledby="admin-activity" className="flex flex-col gap-4">
        <h2 id="admin-activity" className="text-admin-section">
          Admin activity
        </h2>
        {actions.data.length === 0 ? (
          <Empty>No admin changes recorded yet.</Empty>
        ) : (
          <ol className="divide-y divide-line rounded-xl border border-line">
            {actions.data.map((a) => {
              const details = a.details as Record<string, unknown>;
              return (
                <li key={a.id} className="flex items-baseline gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    {ACTION_LABEL[a.action] ?? a.action}
                    {a.action === "agency.change_plan" && typeof details.plan === "string" && (
                      <span className="text-text-2">
                        {" "}
                        to {PLAN_LABEL[details.plan] ?? details.plan}
                      </span>
                    )}
                    <span className="block text-admin-meta">
                      {admins.get(a.admin_id ?? "") ?? "Unknown admin"}
                    </span>
                  </span>
                  <time
                    dateTime={a.created_at}
                    title={formatDateTime(a.created_at)}
                    className="shrink-0 text-text-2 num"
                  >
                    {formatRelative(a.created_at)}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <section aria-labelledby="visitor-activity" className="flex flex-col gap-4">
        <h2 id="visitor-activity" className="text-admin-section">
          Last 30 days
        </h2>
        <dl className="divide-y divide-line rounded-xl border border-line">
          {(
            [
              ["Profile views", totals.profile_view],
              ["Website clicks", totals.website_click],
              ["Contact form opens", totals.contact_open],
              ["Inquiries", totals.inquiry],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex h-10 items-center justify-between px-4">
              <dt className="text-text-2">{k}</dt>
              <dd className={cn("num", v === 0 && "text-text-2")}>{formatCount(v)}</dd>
            </div>
          ))}
        </dl>
        <h2 id="responses" className="mt-4 text-admin-section">
          Replies, last 90 days
        </h2>
        <dl
          aria-labelledby="responses"
          className="divide-y divide-line rounded-xl border border-line"
        >
          <div className="flex h-10 items-center justify-between px-4">
            <dt className="text-text-2">Contacted</dt>
            <dd className="num">
              {routes.data.length === 0
                ? "No leads"
                : `${formatCount(waits.length)} of ${formatCount(routes.data.length)} (${Math.round((waits.length / routes.data.length) * 100)}%)`}
            </dd>
          </div>
          <div className="flex h-10 items-center justify-between px-4">
            <dt className="text-text-2">Median response</dt>
            <dd className={cn("num", median === null && "text-text-2")}>
              {median === null ? "Not enough data" : formatWait(median)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/** 95 → "1 h 35 min"; 2900 → "2 d 0 h". */
function formatWait(minutes: number) {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
}
