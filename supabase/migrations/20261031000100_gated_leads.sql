-- Free editing, gated leads, Pro badge and placement (lib/entitlements.ts).
--  * Owners edit the basics on any plan: website joins the owner update grant (tagline, team
--    size, founded year and languages already had it). Changing the website still flags a
--    Verified badge for review (flag_verified_domain_change).
--  * Every profile takes quote requests. leads.agency_id is the profile it was sent from;
--    consent_fallback is the visitor's yes to "up to 3 similar agencies after 48 hours";
--    summary is a short redacted preview (lib/lead-preview.ts); fallback_at is when the
--    48-hour fallback ran (lib/lead-fallback.tsx).
--  * lead_routes.opened_at: a Pro owner opened the request (the dashboard). via: how it got
--    there (direct = the profile, match = Request proposals, fallback = after 48 hours).
--  * Contact details (name, email, company, links, message) are readable by owners only while
--    on Pro. Free owners read previews through lead_previews(), which returns no contact details.
--  * agency_outreach_contacts: an email address for an unclaimed listing (admin-entered), and its
--    opt-out. agency_outreach: one email per lead, for the rate limit. Service role only.
-- schema.sql has the same objects.

begin;

grant update (website) on agencies to authenticated;

alter table leads
  add column agency_id uuid references agencies(id) on delete set null,
  add column consent_fallback boolean not null default false,
  add column summary text check (char_length(summary) <= 200),
  add column fallback_at timestamptz;
create index leads_fallback_due_idx on leads (created_at)
  where agency_id is not null and consent_fallback and fallback_at is null;

alter table lead_routes
  add column opened_at timestamptz,
  add column via text not null default 'match' check (via in ('direct', 'match', 'fallback'));
grant update (opened_at) on lead_routes to authenticated;

-- Contact details only while on Pro (a lapsed or free owner reads previews instead).
drop policy "agency reads routed leads" on leads;
create policy "agency reads routed leads" on leads for select to authenticated using (
  exists (select 1 from lead_routes lr join agencies a on a.id = lr.agency_id
          where lr.lead_id = leads.id and a.owner_id = auth.uid() and agency_managed(a.id)));

-- The owner's requests without contact details: what a free owner sees. country and summary
-- are the visitor's words, already redacted (summary) or trimmed (country) by the app.
create or replace function lead_previews(p_agency uuid)
returns table (
  lead_id uuid, sent_at timestamptz, contacted_at timestamptz, via text,
  service text, industry text, budget_range text, start_timeline text, goal text,
  country text, summary text
)
language sql stable security definer set search_path = public as $$
  select l.id, r.sent_at, r.contacted_at, r.via, s.name, i.name, l.budget_range,
    l.start_timeline, l.goal, left(l.customer_location, 60), l.summary
  from lead_routes r
  join agencies a on a.id = r.agency_id
  join leads l on l.id = r.lead_id
  left join services s on s.id = l.service_id
  left join industries i on i.id = l.industry_id
  where r.agency_id = p_agency and a.owner_id = auth.uid()
  order by r.sent_at desc
$$;
revoke execute on function lead_previews(uuid) from public, anon;
grant execute on function lead_previews(uuid) to authenticated;

create table agency_outreach_contacts (
  agency_id uuid primary key references agencies(id) on delete cascade,
  email text not null check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on agency_outreach_contacts
  for each row execute function set_updated_at();

create table agency_outreach (
  agency_id uuid not null references agencies(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (agency_id, lead_id)
);
create index agency_outreach_recent_idx on agency_outreach (agency_id, sent_at);

alter table agency_outreach_contacts enable row level security;
alter table agency_outreach enable row level security;
revoke all on agency_outreach_contacts, agency_outreach from anon, authenticated;
grant select, insert, update, delete on agency_outreach_contacts to authenticated;
grant select on agency_outreach to authenticated;
create policy "admin all" on agency_outreach_contacts for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "admin read" on agency_outreach for select to authenticated using (is_admin());

commit;
