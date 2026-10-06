-- ADMIN_V2_SPEC §7 (everything except guides): plans, subscriptions, sponsored slots,
-- verifications, agency events + daily rollup, admin audit log, profiles.notifications_seen_at.
-- schema.sql has the same end state for fresh projects.
--
-- Access model: admins write everything (the app uses the service role after an admin check).
-- Owners read their own subscription, verification and daily event rollups. Anon reads none of
-- these: public pages read what they need server-side with the service role.

begin;

create extension if not exists btree_gist; -- sponsored slot overlap constraint

-- ───────── Plans ─────────
create table plans (
  id text primary key check (id in ('free', 'founding', 'verified')),
  name text not null,
  price_monthly numeric(10, 2),
  price_yearly numeric(10, 2)
);
insert into plans (id, name, price_monthly, price_yearly) values
  ('free', 'Free', 0, 0),
  ('founding', 'Founding', 0, 0),
  ('verified', 'Verified', 29, 249)
on conflict (id) do update set name = excluded.name, price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly;

-- ───────── Subscriptions ─────────
-- No row, or no active row in date, means Free. One active row per agency.
create table agency_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  plan_id text not null references plans(id),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  source text not null check (source in ('manual', 'founding', 'payment')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create unique index agency_subscriptions_one_active on agency_subscriptions (agency_id) where status = 'active';
create index agency_subscriptions_ends_at_idx on agency_subscriptions (ends_at) where status = 'active';

-- ───────── Sponsored slots ─────────
-- A page is a service hub (no industry/location), service × industry or service × location.
-- Up to 3 positions per page; the same position (and the same agency) can't overlap in time.
create table sponsored_slots (
  id uuid primary key default gen_random_uuid(),
  service_id int not null references services(id) on delete cascade,
  industry_id int references industries(id) on delete cascade,
  location_id int references locations(id) on delete cascade,
  agency_id uuid not null references agencies(id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_usd numeric(10, 2) check (price_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (industry_id is null or location_id is null),
  check (ends_at > starts_at),
  constraint sponsored_slots_no_overlap exclude using gist (
    service_id with =, (coalesce(industry_id, 0)) with =, (coalesce(location_id, 0)) with =,
    position with =, tstzrange(starts_at, ends_at) with &&),
  constraint sponsored_slots_one_per_agency exclude using gist (
    service_id with =, (coalesce(industry_id, 0)) with =, (coalesce(location_id, 0)) with =,
    agency_id with =, tstzrange(starts_at, ends_at) with &&)
);
create index sponsored_slots_agency_idx on sponsored_slots (agency_id);

-- ───────── Verifications ─────────
create table verifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected')),
  channels jsonb not null default '[]',
  stats_snapshot jsonb,
  checklist jsonb not null default '{}',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index verifications_one_open on verifications (agency_id) where status = 'requested';
create index verifications_agency_idx on verifications (agency_id);

-- agencies.is_verified is now derived: true while the agency has an approved verification.
-- Public pages and ranking keep reading the column; this trigger is the only thing that sets it.
create or replace function sync_agency_verified() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target uuid := case when tg_op = 'DELETE' then old.agency_id else new.agency_id end;
begin
  update agencies
  set is_verified = exists (select 1 from verifications v where v.agency_id = target and v.status = 'approved')
  where id = target;
  return null;
end $$;
create trigger sync_agency_verified after insert or update or delete on verifications
  for each row execute function sync_agency_verified();

-- Agencies verified before this table existed keep their badge via a migrated approval.
insert into verifications (agency_id, status, checklist, reviewed_at)
select id, 'approved', '{"migrated": true}', now() from agencies where is_verified;

-- ───────── Agency events (beacon) + daily rollup ─────────
-- Raw events live 90 days. visitor_hash is a salted hash of IP + user agent whose salt changes
-- daily (computed in the app), so the same visitor counts once per agency, type and day, and
-- no raw IP is stored. Rollups are kept indefinitely for dashboards.
create table agency_events (
  id bigint generated always as identity primary key,
  agency_id uuid not null references agencies(id) on delete cascade,
  type text not null check (type in ('profile_view', 'website_click', 'contact_open', 'inquiry')),
  page_path text check (char_length(page_path) <= 300),
  visitor_hash text not null check (char_length(visitor_hash) <= 128),
  created_at timestamptz not null default now()
);
create unique index agency_events_once_per_visitor on agency_events (agency_id, type, visitor_hash);
create index agency_events_created_at_idx on agency_events (created_at);

create table agency_event_daily (
  agency_id uuid not null references agencies(id) on delete cascade,
  day date not null,
  type text not null check (type in ('profile_view', 'website_click', 'contact_open', 'inquiry')),
  count int not null default 0 check (count >= 0),
  primary key (agency_id, day, type)
);

-- The only way events are written: dedupes, bumps the rollup, prunes raw rows past 90 days.
-- Service role only (the beacon endpoint and the lead_routes trigger).
create or replace function record_agency_event(p_agency uuid, p_type text, p_path text, p_visitor text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  added int;
begin
  insert into agency_events (agency_id, type, page_path, visitor_hash)
  values (p_agency, p_type, left(p_path, 300), p_visitor)
  on conflict (agency_id, type, visitor_hash) do nothing;
  get diagnostics added = row_count;
  if added = 0 then
    return false;
  end if;
  insert into agency_event_daily (agency_id, day, type, count)
  values (p_agency, (now() at time zone 'utc')::date, p_type, 1)
  on conflict (agency_id, day, type) do update set count = agency_event_daily.count + 1;
  delete from agency_events where created_at < now() - interval '90 days';
  return true;
end $$;
revoke execute on function record_agency_event(uuid, text, text, text) from public, anon, authenticated;

-- Inquiries are counted where they happen, not from the browser: one per lead routed to an agency.
create or replace function record_inquiry_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform record_agency_event(new.agency_id, 'inquiry', null, 'lead:' || new.lead_id::text);
  return null;
end $$;
create trigger record_inquiry_event after insert on lead_routes
  for each row execute function record_inquiry_event();

-- ───────── Admin audit log ─────────
-- Append-only: written by the service role after an admin check; nobody updates or deletes.
create table admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_actions_entity_idx on admin_actions (entity_type, entity_id, created_at desc);
create index admin_actions_created_at_idx on admin_actions (created_at desc);

-- ───────── Notifications ─────────
alter table profiles add column if not exists notifications_seen_at timestamptz;

-- ───────── updated_at ─────────
create trigger set_updated_at before update on agency_subscriptions for each row execute function set_updated_at();
create trigger set_updated_at before update on sponsored_slots for each row execute function set_updated_at();
create trigger set_updated_at before update on verifications for each row execute function set_updated_at();

-- ───────── Row Level Security ─────────
alter table plans enable row level security;
alter table agency_subscriptions enable row level security;
alter table sponsored_slots enable row level security;
alter table verifications enable row level security;
alter table agency_events enable row level security;
alter table agency_event_daily enable row level security;
alter table admin_actions enable row level security;

-- Anon gets nothing here, not even through a mistaken policy.
revoke all on plans, agency_subscriptions, sponsored_slots, verifications, agency_events,
  agency_event_daily, admin_actions from anon;

create policy "signed-in read" on plans for select to authenticated using (true);
create policy "admin write" on plans for all to authenticated using (is_admin()) with check (is_admin());

create policy "owner or admin read" on agency_subscriptions for select to authenticated using (
  is_admin() or exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));
create policy "admin write" on agency_subscriptions for all to authenticated using (is_admin()) with check (is_admin());

create policy "admin all" on sponsored_slots for all to authenticated using (is_admin()) with check (is_admin());

create policy "owner or admin read" on verifications for select to authenticated using (
  is_admin() or exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));
create policy "admin write" on verifications for all to authenticated using (is_admin()) with check (is_admin());

create policy "admin read" on agency_events for select to authenticated using (is_admin());

create policy "owner or admin read" on agency_event_daily for select to authenticated using (
  is_admin() or exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));

create policy "admin read" on admin_actions for select to authenticated using (is_admin());

commit;
