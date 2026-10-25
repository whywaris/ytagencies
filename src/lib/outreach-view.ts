// What each Admin → Outreach tab shows, built from plain rows (app/admin/outreach/page.tsx renders
// it). Pure, no imports: tests/outreach.test.mjs builds every tab with empty settings, no
// agencies, no contacts and no messages, so the page can't crash on an empty setup.

export type AgencyRow = {
  id: string;
  slug: string;
  name: string;
  hq_location_id: number | null;
  agency_services: { services: { slug: string } }[];
};
export type ContactRow = { agency_id: string; email: string; opted_out_at: string | null };
export type MessageRow = {
  agency_id: string;
  template: string;
  status: string;
  batch_id: string | null;
  queued_at: string;
  sent_at: string | null;
  clicked_at: string | null;
  claimed_at: string | null;
};
export type Location = { id: number; slug: string; name: string; type: string; parentId: number | null };

const DAY_MS = 86_400_000;

export function dashboardView(messages: MessageRow[], contacts: ContactRow[], now: Date) {
  const count = (f: (m: MessageRow) => boolean) => messages.filter(f).length;
  const cards: [string, number][] = [
    ["Queued", count((m) => m.status === "queued")],
    ["Sent", count((m) => !!m.sent_at)],
    ["Delivered", count((m) => m.status === "delivered")],
    ["Bounced", count((m) => m.status === "bounced" || m.status === "complained")],
    ["Clicked", count((m) => !!m.clicked_at)],
    ["Claimed", new Set(messages.filter((m) => m.claimed_at).map((m) => m.agency_id)).size],
    ["Unsubscribed", contacts.filter((c) => c.opted_out_at).length],
  ];
  const days = Array.from({ length: 14 }, (_, i) => new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10));
  const byDay = days.map((day) => ({
    day,
    sent: count((m) => m.sent_at?.slice(0, 10) === day),
    clicked: count((m) => m.clicked_at?.slice(0, 10) === day),
  }));
  const batches = new Map<string, { id: string; at: string; total: number; sent: number; clicked: number; claimed: number }>();
  for (const m of messages) {
    if (!m.batch_id || m.template !== "invite") continue;
    const b = batches.get(m.batch_id) ?? { id: m.batch_id, at: m.queued_at, total: 0, sent: 0, clicked: 0, claimed: 0 };
    b.total++;
    if (m.sent_at) b.sent++;
    if (m.clicked_at) b.clicked++;
    if (m.claimed_at) b.claimed++;
    if (m.queued_at < b.at) b.at = m.queued_at;
    batches.set(m.batch_id, b);
  }
  return { cards, byDay, batches: [...batches.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30) };
}

export type AgencyFilters = {
  email: string;
  contacted: string;
  country: string;
  service: string;
  optout: string;
  bounced: string;
};

export function agenciesView(
  agencies: AgencyRow[],
  contacts: ContactRow[],
  messages: MessageRow[],
  suppressed: Set<string>,
  locations: Location[],
  f: AgencyFilters,
  page: number,
  perPage = 100,
) {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const countryOf = (id: number | null) => {
    const l = id === null ? undefined : byId.get(id);
    return l?.type === "city" ? byId.get(l.parentId ?? -1)?.slug : l?.slug;
  };
  const contactOf = new Map(contacts.map((c) => [c.agency_id, c]));
  const messagesOf = new Map<string, MessageRow[]>();
  for (const m of messages) messagesOf.set(m.agency_id, [...(messagesOf.get(m.agency_id) ?? []), m]);

  const rows = agencies.map((a) => {
    const c = contactOf.get(a.id);
    const ms = messagesOf.get(a.id) ?? [];
    const latest = ms.find((m) => m.template === "reminder") ?? ms.find((m) => m.template === "invite");
    const bounced = !!c && suppressed.has(c.email.toLowerCase());
    const status = !c
      ? "No email"
      : c.opted_out_at
        ? "Unsubscribed"
        : bounced
          ? "Bounced"
          : latest
            ? `${latest.template === "invite" ? "Invite" : "Reminder"} ${latest.status}${latest.clicked_at ? ", clicked" : ""}`
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
  const pages = Math.max(1, Math.ceil(shown.length / perPage));
  const current = Math.min(Math.max(1, page || 1), pages);
  const countries = [...new Set(rows.map((r) => r.country).filter((c): c is string => !!c))]
    .map((slug) => locations.find((l) => l.slug === slug))
    .filter((l): l is Location => !!l)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    total: shown.length,
    page: current,
    pages,
    rows: shown.slice((current - 1) * perPage, current * perPage).map(({ id, name, slug, email, status, canQueue }) => ({ id, name, slug, email, status, canQueue })),
    countries,
  };
}

export function contactsView(agencies: AgencyRow[], contacts: ContactRow[], q: string) {
  const emailOf = new Map(contacts.map((c) => [c.agency_id, c.email]));
  const term = q.trim().toLowerCase();
  const list = (term
    ? agencies.filter((a) => a.name.toLowerCase().includes(term) || a.slug.includes(term))
    : agencies.filter((a) => emailOf.has(a.id))
  )
    .slice(0, 100)
    .map((a) => ({ id: a.id, name: a.name, email: emailOf.get(a.id) ?? "" }));
  return { term, saved: emailOf.size, list };
}

/**
 * The template preview's agencies: unclaimed agencies that have an address (at most 200), or a
 * clearly labelled sample when none do. Links are built by the caller's functions, which must not
 * throw (a missing CLAIM_TOKEN_SECRET shows a placeholder instead).
 */
export function templatesView(
  agencies: AgencyRow[],
  contacts: ContactRow[],
  links: {
    profile: (slug: string) => string;
    claim: (slug: string) => string;
    unsubscribe: (id: string) => string;
  },
  sample: { id: string; slug: string; name: string },
) {
  const withEmail = new Set(contacts.map((c) => c.agency_id));
  const real = agencies.filter((a) => withEmail.has(a.id)).slice(0, 200);
  const list = real.length ? real.map((a) => ({ id: a.id, slug: a.slug, name: a.name, sample: false })) : [{ ...sample, sample: true }];
  return {
    sample: !real.length,
    agencies: list.map((a) => ({ id: a.id, name: a.sample ? `${a.name} (sample)` : a.name, sample: a.sample })),
    previewVars: Object.fromEntries(
      list.map((a) => [
        a.id,
        {
          agency_name: a.name,
          profile_url: links.profile(a.slug),
          claim_url: links.claim(a.slug),
          unsubscribe_url: links.unsubscribe(a.id),
        },
      ]),
    ),
  };
}
