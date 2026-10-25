import Link from "next/link";

import {
  AgenciesQueue,
  ContactImport,
  ContactRow,
  OutreachSettingsForm,
  PauseSwitch,
  type QueueRow,
} from "@/components/admin/outreach";
import { Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getLocations, getServices } from "@/lib/data/taxonomy";
import { unsubscribeUrl } from "@/lib/outreach";
import { claimLink, getOutreachSettings } from "@/lib/outreach-mail";
import { sendingProblems } from "@/lib/outreach-rules";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

// Admin → Growth → Outreach: invites to unclaimed agencies to claim their free profile
// (lib/outreach-mail.ts). Dashboard, the agencies to invite, their addresses, and the templates.

export const metadata = { title: "Outreach" };

const TABS = [
  ["dashboard", "Dashboard"],
  ["agencies", "Agencies"],
  ["contacts", "Contacts"],
  ["templates", "Templates"],
] as const;
type Tab = (typeof TABS)[number][0];
const PER_PAGE = 100;
const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);

type Db = ReturnType<typeof createAdminClient>;

async function unclaimedAgencies(db: Db) {
  const rows: { id: string; slug: string; name: string; hq_location_id: number | null; agency_services: { services: { slug: string } }[] }[] = [];
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
  return { contacts: contacts.data, messages: messages.data, suppressed: new Set(suppressed.data.map((s) => s.email)) };
}

const STATUS_LABEL: Record<string, string> = {
  queued: "queued",
  sent: "sent",
  delivered: "delivered",
  bounced: "bounced",
  complained: "complained",
  failed: "failed",
  cancelled: "cancelled",
};

export default async function OutreachPage({ searchParams }: PageProps<"/admin/outreach">) {
  await requireAdmin("/admin/outreach");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? String(sp[k]) : "");
  const tab: Tab = (TABS.map((t) => t[0]) as string[]).includes(str("tab")) ? (str("tab") as Tab) : "dashboard";
  const db = createAdminClient();
  const settings = await getOutreachSettings(db);
  const problems = sendingProblems(settings);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-reading flex-col gap-1">
        <h1 className="text-admin-title">Outreach</h1>
        <p className="text-text-2">
          Invite unclaimed agencies to claim their free profile. At most an invite and one reminder per
          agency, never to claimed, unsubscribed or bounced addresses.
        </p>
      </div>
      <PauseSwitch paused={settings.paused} problems={problems} />
      <nav aria-label="Outreach" className="flex gap-1 border-b border-line">
        {TABS.map(([id, label]) => (
          <Link
            key={id}
            href={`/admin/outreach?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-[14px] font-medium", tab === id ? "border-accent" : "border-transparent text-text-2 hover:text-text")}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "dashboard" && <Dashboard db={db} />}
      {tab === "agencies" && <Agencies db={db} str={str} />}
      {tab === "contacts" && <Contacts db={db} q={str("q")} />}
      {tab === "templates" && <Templates db={db} settings={settings} />}
    </div>
  );
}

async function Dashboard({ db }: { db: Db }) {
  const { contacts, messages } = await outreachState(db);
  const count = (f: (m: (typeof messages)[number]) => boolean) => messages.filter(f).length;
  const cards: [string, number][] = [
    ["Queued", count((m) => m.status === "queued")],
    ["Sent", count((m) => !!m.sent_at)],
    ["Delivered", count((m) => m.status === "delivered")],
    ["Bounced", count((m) => m.status === "bounced" || m.status === "complained")],
    ["Clicked", count((m) => !!m.clicked_at)],
    ["Claimed", new Set(messages.filter((m) => m.claimed_at).map((m) => m.agency_id)).size],
    ["Unsubscribed", contacts.filter((c) => c.opted_out_at).length],
  ];
  const days = Array.from({ length: 14 }, (_, i) => daysAgo(i));
  const byDay = days.map((d) => ({
    day: d,
    sent: count((m) => m.sent_at?.slice(0, 10) === d),
    clicked: count((m) => m.clicked_at?.slice(0, 10) === d),
  }));
  const batches = new Map<string, { at: string; total: number; sent: number; clicked: number; claimed: number }>();
  for (const m of messages) {
    if (!m.batch_id || m.template !== "invite") continue;
    const b = batches.get(m.batch_id) ?? { at: m.queued_at, total: 0, sent: 0, clicked: 0, claimed: 0 };
    b.total++;
    if (m.sent_at) b.sent++;
    if (m.clicked_at) b.clicked++;
    if (m.claimed_at) b.claimed++;
    if (m.queued_at < b.at) b.at = m.queued_at;
    batches.set(m.batch_id, b);
  }
  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {cards.map(([label, n]) => (
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
            {byDay.map((d) => (
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
        {batches.size ? (
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
              {[...batches.values()]
                .sort((a, b) => b.at.localeCompare(a.at))
                .slice(0, 30)
                .map((b) => (
                  <tr key={b.at}>
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
  const byId = new Map(locations.map((l) => [l.id, l]));
  const countryOf = (id: number | null) => {
    const l = id === null ? null : byId.get(id);
    return l?.type === "city" ? byId.get(l.parentId ?? -1)?.slug : l?.slug;
  };
  const contactOf = new Map(state.contacts.map((c) => [c.agency_id, c]));
  const messagesOf = new Map<string, typeof state.messages>();
  for (const m of state.messages) messagesOf.set(m.agency_id, [...(messagesOf.get(m.agency_id) ?? []), m]);

  const rows = agencies.map((a) => {
    const c = contactOf.get(a.id);
    const ms = messagesOf.get(a.id) ?? [];
    const latest = ms.find((m) => m.template === "reminder") ?? ms.find((m) => m.template === "invite");
    const bounced = !!c && state.suppressed.has(c.email.toLowerCase());
    const status = !c
      ? "No email"
      : c.opted_out_at
        ? "Unsubscribed"
        : bounced
          ? "Bounced"
          : latest
            ? `${latest.template === "invite" ? "Invite" : "Reminder"} ${STATUS_LABEL[latest.status] ?? latest.status}${latest.clicked_at ? ", clicked" : ""}`
            : "Not contacted";
    return {
      id: a.id,
      name: a.name,
      slug: a.slug,
      email: c?.email ?? null,
      status,
      canQueue: !!c && !c.opted_out_at && !bounced && !ms.some((m) => m.template === "invite"),
      country: countryOf(a.hq_location_id),
      services: a.agency_services.map((s) => s.services.slug),
      contacted: ms.length > 0,
      optedOut: !!c?.opted_out_at,
      bounced,
    };
  });
  const f = { email: str("email"), contacted: str("contacted"), country: str("country"), service: str("service"), optout: str("optout"), bounced: str("bounced") };
  const shown = rows.filter(
    (r) =>
      (f.email !== "yes" || r.email) &&
      (f.email !== "no" || !r.email) &&
      (f.contacted !== "no" || !r.contacted) &&
      (!f.country || r.country === f.country) &&
      (!f.service || r.services.includes(f.service)) &&
      (f.optout !== "1" || r.optedOut) &&
      (f.bounced !== "1" || r.bounced),
  );
  const page = Math.max(1, Number(str("page")) || 1);
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const slice: QueueRow[] = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const countries = [...new Set(rows.map((r) => r.country).filter((c): c is string => !!c))]
    .map((slug) => locations.find((l) => l.slug === slug)!)
    .sort((a, b) => a.name.localeCompare(b.name));
  const qs = (patch: Record<string, string>) =>
    `/admin/outreach?${new URLSearchParams(Object.entries({ tab: "agencies", ...f, ...patch }).filter(([, v]) => v))}`;
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
          {countries.map((c) => (
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
        {shown.length} unclaimed published agenc{shown.length === 1 ? "y" : "ies"}
        {pages > 1 && ` · page ${page} of ${pages}`}
      </p>
      <AgenciesQueue rows={slice} />
      {pages > 1 && (
        <nav aria-label="Pages" className="flex gap-3 text-[14px]">
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className="text-accent hover:underline">Previous</Link>}
          {page < pages && <Link href={qs({ page: String(page + 1) })} className="text-accent hover:underline">Next</Link>}
        </nav>
      )}
    </div>
  );
}

async function Contacts({ db, q }: { db: Db; q: string }) {
  const [agencies, state] = await Promise.all([unclaimedAgencies(db), outreachState(db)]);
  const contactOf = new Map(state.contacts.map((c) => [c.agency_id, c.email]));
  const term = q.trim().toLowerCase();
  const list = (term ? agencies.filter((a) => a.name.toLowerCase().includes(term) || a.slug.includes(term)) : agencies.filter((a) => contactOf.has(a.id))).slice(0, 100);
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
          <input name="q" defaultValue={q} placeholder="Find an agency to add or edit" className="h-9 w-72 rounded-lg border border-line bg-bg px-3 text-[14px]" aria-label="Find an agency" />
          <button type="submit" className="h-9 rounded-lg border border-line px-3 text-[14px] font-medium">Search</button>
        </form>
        <p className="text-admin-meta">
          {term ? `Unclaimed agencies matching “${q}”` : `${contactOf.size} saved address${contactOf.size === 1 ? "" : "es"}`}
          {list.length === 100 && " (first 100)"}
        </p>
        {list.length ? (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {list.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-medium">{a.name}</span>
                <ContactRow agencyId={a.id} email={contactOf.get(a.id) ?? ""} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-2">{term ? "No unclaimed agency matches." : "No addresses yet."}</p>
        )}
      </section>
    </div>
  );
}

async function Templates({ db, settings }: { db: Db; settings: Awaited<ReturnType<typeof getOutreachSettings>> }) {
  const agencies = (await unclaimedAgencies(db)).slice(0, 200);
  const previewVars = Object.fromEntries(
    agencies.map((a) => [
      a.id,
      {
        agency_name: a.name,
        profile_url: absoluteUrl(`/agency/${a.slug}`),
        claim_url: claimLink(a.slug, "sample-token"),
        unsubscribe_url: unsubscribeUrl(a.id),
      },
    ]),
  );
  return (
    <OutreachSettingsForm
      agencies={agencies.map((a) => ({ id: a.id, name: a.name }))}
      previewVars={previewVars}
      initial={{
        senderName: settings.senderName,
        from: settings.from,
        replyTo: settings.replyTo,
        businessAddress: settings.businessAddress,
        dailyCap: settings.dailyCap,
        reminderDays: settings.reminderDays,
        inviteSubject: settings.templates.invite.subject,
        inviteBody: settings.templates.invite.body,
        reminderSubject: settings.templates.reminder.subject,
        reminderBody: settings.templates.reminder.body,
      }}
    />
  );
}
