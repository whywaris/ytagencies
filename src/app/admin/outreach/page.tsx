import Link from "next/link";

import {
  AgenciesQueue,
  ContactImport,
  ContactRow,
  SendingSettingsForm,
  StatusBanner,
  TemplatesForm,
} from "@/components/admin/outreach";
import { Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getLocations, getServices } from "@/lib/data/taxonomy";
import { linkSecretReady, unsubscribeUrl } from "@/lib/outreach";
import { claimLink, getOutreachSettings, type Settings } from "@/lib/outreach-mail";
import { OUTREACH_FROM_DOMAIN, outreachStatus, SAMPLE_AGENCY } from "@/lib/outreach-rules";
import {
  agenciesView,
  contactsView,
  dashboardView,
  templatesView,
  type AgencyRow,
  type ContactRow as ContactData,
  type MessageRow,
} from "@/lib/outreach-view";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

// Admin → Growth → Outreach: invites to unclaimed agencies to claim their free profile
// (lib/outreach-mail.ts). What each tab shows comes from lib/outreach-view.ts (tested with an
// empty setup); this file only fetches rows and renders.

export const metadata = { title: "Outreach" };

const TABS = [
  ["dashboard", "Dashboard"],
  ["agencies", "Agencies"],
  ["contacts", "Contacts"],
  ["templates", "Templates"],
  ["settings", "Settings"],
] as const;
type Tab = (typeof TABS)[number][0];

type Db = ReturnType<typeof createAdminClient>;

async function unclaimedAgencies(db: Db) {
  const rows: AgencyRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("agencies")
      .select("id, slug, name, hq_location_id, agency_services(services(slug))")
      .eq("status", "published")
      .eq("is_claimed", false)
      .order("name")
      .range(from, from + 999);
    if (error) throw new Error("Couldn't load agencies");
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function outreachState(db: Db) {
  const [contacts, messages, suppressed] = await Promise.all([
    db.from("agency_outreach_contacts").select("agency_id, email, opted_out_at").limit(5000),
    db
      .from("outreach_messages")
      .select("agency_id, template, status, batch_id, queued_at, sent_at, clicked_at, claimed_at")
      .limit(10000),
    db.from("outreach_suppressions").select("email").limit(10000),
  ]);
  if (contacts.error || messages.error || suppressed.error) throw new Error("Couldn't load outreach");
  return {
    contacts: contacts.data as ContactData[],
    messages: messages.data as MessageRow[],
    suppressed: new Set(suppressed.data.map((s) => s.email)),
  };
}

export default async function OutreachPage({ searchParams }: PageProps<"/admin/outreach">) {
  await requireAdmin("/admin/outreach");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? String(sp[k]) : "");
  const tab: Tab = (TABS.map((t) => t[0]) as string[]).includes(str("tab")) ? (str("tab") as Tab) : "dashboard";
  const db = createAdminClient();
  const settings = await getOutreachSettings(db);
  const linksReady = linkSecretReady();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-reading flex-col gap-1">
        <h1 className="text-admin-title">Outreach</h1>
        <p className="text-text-2">
          Invite unclaimed agencies to claim their free profile. At most an invite and one reminder per
          agency, never to claimed, unsubscribed or bounced addresses.
        </p>
      </div>
      <StatusBanner status={outreachStatus({ ...settings, linksReady })} paused={settings.paused} />
      <nav aria-label="Outreach" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map(([id, label]) => (
          <Link
            key={id}
            href={`/admin/outreach?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[14px] font-medium",
              tab === id ? "border-accent" : "border-transparent text-text-2 hover:text-text",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "dashboard" && <Dashboard db={db} />}
      {tab === "agencies" && <Agencies db={db} str={str} />}
      {tab === "contacts" && <Contacts db={db} q={str("q")} />}
      {tab === "templates" && <Templates db={db} settings={settings} linksReady={linksReady} />}
      {tab === "settings" && (
        <SendingSettingsForm
          fromDomain={OUTREACH_FROM_DOMAIN}
          initial={{
            senderName: settings.senderName,
            from: settings.from,
            replyTo: settings.replyTo,
            businessAddress: settings.businessAddress,
            dailyCap: settings.dailyCap,
            reminderDays: settings.reminderDays,
          }}
        />
      )}
    </div>
  );
}

async function Dashboard({ db }: { db: Db }) {
  const { contacts, messages } = await outreachState(db);
  const v = dashboardView(messages, contacts, new Date());
  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {v.cards.map(([label, n]) => (
          <div key={label} className="rounded-xl border border-line p-4">
            <dt className="text-admin-meta">{label}</dt>
            <dd className="num text-[24px] font-semibold">{n}</dd>
          </div>
        ))}
      </dl>
      <section className="flex flex-col gap-3">
        <h2 className="text-admin-section">Last 14 days</h2>
        <Table>
          <thead>
            <tr>
              <th scope="col">Day (UTC)</th>
              <th scope="col">Sent</th>
              <th scope="col">Clicked</th>
            </tr>
          </thead>
          <tbody>
            {v.byDay.map((d) => (
              <tr key={d.day}>
                <td className="num">{d.day}</td>
                <td className="num">{d.sent}</td>
                <td className="num">{d.clicked}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-admin-section">Batches</h2>
        {v.batches.length ? (
          <Table>
            <thead>
              <tr>
                <th scope="col">Queued</th>
                <th scope="col">Invites</th>
                <th scope="col">Sent</th>
                <th scope="col">Clicked</th>
                <th scope="col">Claimed</th>
              </tr>
            </thead>
            <tbody>
              {v.batches.map((b) => (
                <tr key={b.id}>
                  <td className="num">{b.at.slice(0, 16).replace("T", " ")}</td>
                  <td className="num">{b.total}</td>
                  <td className="num">{b.sent}</td>
                  <td className="num">{b.clicked}</td>
                  <td className="num">{b.claimed}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-text-2">Nothing queued yet. Add addresses in Contacts, then queue invites in Agencies.</p>
        )}
      </section>
    </div>
  );
}

async function Agencies({ db, str }: { db: Db; str: (k: string) => string }) {
  const [agencies, state, services, locations] = await Promise.all([
    unclaimedAgencies(db),
    outreachState(db),
    getServices(),
    getLocations(),
  ]);
  const f = {
    email: str("email"),
    contacted: str("contacted"),
    country: str("country"),
    service: str("service"),
    optout: str("optout"),
    bounced: str("bounced"),
  };
  const v = agenciesView(agencies, state.contacts, state.messages, state.suppressed, locations, f, Number(str("page")) || 1);
  const qs = (patch: Record<string, string>) =>
    `/admin/outreach?${new URLSearchParams(Object.entries({ tab: "agencies", ...f, ...patch }).filter(([, x]) => x))}`;
  const select = "h-9 rounded-lg border border-line bg-bg px-2 text-[14px]";

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-end gap-2" action="/admin/outreach">
        <input type="hidden" name="tab" value="agencies" />
        <select name="email" defaultValue={f.email} className={select} aria-label="Email">
          <option value="">Any email</option>
          <option value="yes">Has email</option>
          <option value="no">No email</option>
        </select>
        <select name="contacted" defaultValue={f.contacted} className={select} aria-label="Contacted">
          <option value="">Contacted or not</option>
          <option value="no">Not contacted</option>
        </select>
        <select name="country" defaultValue={f.country} className={select} aria-label="Country">
          <option value="">Any country</option>
          {v.countries.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="service" defaultValue={f.service} className={select} aria-label="Service">
          <option value="">Any service</option>
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[14px]">
          <input type="checkbox" name="optout" value="1" defaultChecked={f.optout === "1"} /> Unsubscribed
        </label>
        <label className="flex items-center gap-1.5 text-[14px]">
          <input type="checkbox" name="bounced" value="1" defaultChecked={f.bounced === "1"} /> Bounced
        </label>
        <button type="submit" className="h-9 rounded-lg border border-line px-3 text-[14px] font-medium">
          Filter
        </button>
      </form>
      <p className="text-admin-meta">
        {v.total} unclaimed published agenc{v.total === 1 ? "y" : "ies"}
        {v.pages > 1 && ` · page ${v.page} of ${v.pages}`}
      </p>
      {v.rows.length ? <AgenciesQueue rows={v.rows} /> : <p className="text-text-2">No agencies match these filters.</p>}
      {v.pages > 1 && (
        <nav aria-label="Pages" className="flex gap-3 text-[14px]">
          {v.page > 1 && (
            <Link href={qs({ page: String(v.page - 1) })} className="text-accent hover:underline">
              Previous
            </Link>
          )}
          {v.page < v.pages && (
            <Link href={qs({ page: String(v.page + 1) })} className="text-accent hover:underline">
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

async function Contacts({ db, q }: { db: Db; q: string }) {
  const [agencies, state] = await Promise.all([unclaimedAgencies(db), outreachState(db)]);
  const v = contactsView(agencies, state.contacts, q);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-admin-section">Import a CSV</h2>
        <ContactImport />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-admin-section">Addresses</h2>
        <form action="/admin/outreach" className="flex gap-2">
          <input type="hidden" name="tab" value="contacts" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Find an agency to add or edit"
            className="h-9 w-72 rounded-lg border border-line bg-bg px-3 text-[14px]"
            aria-label="Find an agency"
          />
          <button type="submit" className="h-9 rounded-lg border border-line px-3 text-[14px] font-medium">
            Search
          </button>
        </form>
        <p className="text-admin-meta">
          {v.term ? `Unclaimed agencies matching “${q}”` : `${v.saved} saved address${v.saved === 1 ? "" : "es"}`}
          {v.list.length === 100 && " (first 100)"}
        </p>
        {v.list.length ? (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {v.list.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-medium">{a.name}</span>
                <ContactRow agencyId={a.id} email={a.email} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-2">
            {v.term ? "No unclaimed agency matches." : "No addresses yet. Search for an agency above, or import a CSV."}
          </p>
        )}
      </section>
    </div>
  );
}

async function Templates({ db, settings, linksReady }: { db: Db; settings: Settings; linksReady: boolean }) {
  const [agencies, state] = await Promise.all([unclaimedAgencies(db), outreachState(db)]);
  const v = templatesView(
    agencies,
    state.contacts,
    {
      profile: (slug) => absoluteUrl(`/agency/${slug}`),
      claim: (slug) => claimLink(slug, "sample-token"),
      // Never throws: without CLAIM_TOKEN_SECRET the preview shows a placeholder (and nothing sends).
      unsubscribe: (id) => (linksReady ? unsubscribeUrl(id) : "[unsubscribe link: CLAIM_TOKEN_SECRET isn't set]"),
    },
    SAMPLE_AGENCY,
  );
  return (
    <TemplatesForm
      agencies={v.agencies}
      previewVars={v.previewVars}
      sample={v.sample}
      senderName={settings.senderName}
      businessAddress={settings.businessAddress}
      initial={{
        inviteSubject: settings.templates.invite.subject,
        inviteBody: settings.templates.invite.body,
        reminderSubject: settings.templates.reminder.subject,
        reminderBody: settings.templates.reminder.body,
      }}
    />
  );
}
