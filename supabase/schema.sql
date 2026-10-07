-- YouTube Agency Directory — v1 schema (Supabase / Postgres)

create extension if not exists "pgcrypto";

-- ───────── Users ─────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('user','agency','admin')),
  created_at timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ───────── Taxonomy ─────────
create table services (
  id serial primary key,
  slug text unique not null,            -- youtube-ads-agencies
  name text not null,                   -- YouTube Ads
  intro text,
  sort_order int default 0,
  updated_at timestamptz not null default now()
);

create table industries (
  id serial primary key,
  slug text unique not null,            -- doctors
  name text not null,                   -- Doctors & clinics
  intro text,
  sort_order int default 0,
  updated_at timestamptz not null default now()
);

create table locations (
  id serial primary key,
  slug text unique not null,            -- usa, london
  name text not null,
  type text not null check (type in ('country','city')),
  parent_id int references locations(id)
);

-- Unique copy for programmatic combination pages
create table service_industry_content (
  service_id int references services(id) on delete cascade,
  industry_id int references industries(id) on delete cascade,
  intro text,
  how_to_choose text,
  faqs jsonb default '[]',
  updated_at timestamptz not null default now(),
  primary key (service_id, industry_id)
);

-- ───────── Agencies ─────────
create table agencies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text,
  description text,
  website text,
  logo_path text,
  founded_year int,
  team_size text check (team_size in ('1-10','11-50','51-200','200+')),
  min_budget_usd int,
  pricing_model text check (pricing_model in ('retainer','per_video','performance','project')),
  languages text[] default '{}',
  hq_location_id int references locations(id),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_claimed boolean not null default false,
  is_verified boolean not null default false,
  owner_id uuid references auth.users(id),
  search tsvector generated always as (
    to_tsvector('english', coalesce(name,'') || ' ' || coalesce(tagline,'') || ' ' || coalesce(description,''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agencies_search_idx on agencies using gin (search);
create index agencies_status_idx on agencies (status);

create table agency_services (
  agency_id uuid references agencies(id) on delete cascade,
  service_id int references services(id) on delete cascade,
  is_primary boolean default false,
  primary key (agency_id, service_id)
);

create table agency_industries (
  agency_id uuid references agencies(id) on delete cascade,
  industry_id int references industries(id) on delete cascade,
  is_primary boolean default false,
  primary key (agency_id, industry_id)
);

create table agency_locations (
  agency_id uuid references agencies(id) on delete cascade,
  location_id int references locations(id) on delete cascade,
  primary key (agency_id, location_id)
);

create table case_studies (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  title text not null,
  client_industry_id int references industries(id),
  channel_url text,
  summary text,
  metrics jsonb default '{}',           -- {"subs_before":1200,"subs_after":45000,"roas":3.2}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  author_id uuid references auth.users(id),
  author_name text not null,
  author_company text,
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 30 and 2000),
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────── Leads & claims ─────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  service_id int references services(id),
  industry_id int references industries(id),
  budget_range text,
  message text,
  created_at timestamptz not null default now()
);

create table lead_routes (               -- which agencies received which lead
  lead_id uuid references leads(id) on delete cascade,
  agency_id uuid references agencies(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (lead_id, agency_id)
);

create table claims (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  work_email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- ───────── Row Level Security ─────────
alter table profiles enable row level security;
alter table services enable row level security;
alter table industries enable row level security;
alter table locations enable row level security;
alter table service_industry_content enable row level security;
alter table agencies enable row level security;
alter table agency_services enable row level security;
alter table agency_industries enable row level security;
alter table agency_locations enable row level security;
alter table case_studies enable row level security;
alter table reviews enable row level security;
alter table leads enable row level security;
alter table lead_routes enable row level security;
alter table claims enable row level security;

-- Profiles
create policy "own profile read" on profiles for select using (id = auth.uid() or is_admin());
create policy "own profile update" on profiles for update using (id = auth.uid())
  with check (role = (select role from profiles where id = auth.uid())); -- can't self-promote

-- Public taxonomy
create policy "public read" on services for select using (true);
create policy "public read" on industries for select using (true);
create policy "public read" on locations for select using (true);
create policy "public read" on service_industry_content for select using (true);
create policy "admin write" on services for all using (is_admin()) with check (is_admin());
create policy "admin write" on industries for all using (is_admin()) with check (is_admin());
create policy "admin write" on locations for all using (is_admin()) with check (is_admin());
create policy "admin write" on service_industry_content for all using (is_admin()) with check (is_admin());

-- Agencies
-- anon can't read owner_id (column grants below), so no policy anon evaluates may mention it:
-- Postgres checks column privileges inside policy expressions too. Owner/admin policies are
-- therefore scoped to authenticated, and anon gets status-only policies.
create policy "anon read published" on agencies for select to anon
  using (status = 'published');
create policy "read published or own" on agencies for select to authenticated
  using (status = 'published' or owner_id = auth.uid() or is_admin());
create policy "owner update" on agencies for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and is_verified = false); -- the verified flag is admin-only
create policy "admin all" on agencies for all to authenticated using (is_admin()) with check (is_admin());

-- Agency join tables & case studies: public read if agency is published; owner manages
create policy "anon read published" on agency_services for select to anon using (
  exists (select 1 from agencies a where a.id = agency_id and a.status = 'published'));
create policy "public read" on agency_services for select to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and (a.status = 'published' or a.owner_id = auth.uid() or is_admin())));
create policy "owner manage" on agency_services for all to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and (a.owner_id = auth.uid() or is_admin())));

create policy "anon read published" on agency_industries for select to anon using (
  exists (select 1 from agencies a where a.id = agency_id and a.status = 'published'));
create policy "public read" on agency_industries for select to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and (a.status = 'published' or a.owner_id = auth.uid() or is_admin())));
create policy "owner manage" on agency_industries for all to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and (a.owner_id = auth.uid() or is_admin())));

create policy "anon read published" on agency_locations for select to anon using (
  exists (select 1 from agencies a where a.id = agency_id and a.status = 'published'));
create policy "public read" on agency_locations for select to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and (a.status = 'published' or a.owner_id = auth.uid() or is_admin())));
create policy "owner manage" on agency_locations for all to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and (a.owner_id = auth.uid() or is_admin())));

create policy "anon read published" on case_studies for select to anon using (
  exists (select 1 from agencies a where a.id = agency_id and a.status = 'published'));
create policy "public read" on case_studies for select to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and (a.status = 'published' or a.owner_id = auth.uid() or is_admin())));
create policy "owner manage" on case_studies for all to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and (a.owner_id = auth.uid() or is_admin())));

-- Reviews: public sees published; inserts go through a server action (Turnstile + rate limit)
create policy "public read published" on reviews for select using (status = 'published' or is_admin());
create policy "admin moderate" on reviews for all using (is_admin()) with check (is_admin());

-- Leads: never public. Inserted server-side with the service role after Turnstile + rate limit.
create policy "admin read" on leads for select to authenticated using (is_admin());
create policy "agency reads routed leads" on leads for select to authenticated using (
  exists (select 1 from lead_routes lr join agencies a on a.id = lr.agency_id
          where lr.lead_id = leads.id and a.owner_id = auth.uid()));
create policy "agency reads own routes" on lead_routes for select to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()) or is_admin());

-- Claims
create policy "own claims" on claims for select using (user_id = auth.uid() or is_admin());
create policy "create claim" on claims for insert with check (user_id = auth.uid() and status = 'pending');
create policy "admin review" on claims for update using (is_admin()) with check (is_admin());

-- ───────── Helper: agency counts for the thin-page rule ─────────
create or replace view combo_counts with (security_invoker = true) as
select s.slug as service_slug, i.slug as industry_slug, count(distinct a.id) as agency_count
from agencies a
join agency_services ags on ags.agency_id = a.id
join services s on s.id = ags.service_id
join agency_industries agi on agi.agency_id = a.id
join industries i on i.id = agi.industry_id
where a.status = 'published'
group by s.slug, i.slug;

-- ───────── Rate limiting for public forms (SECURITY.md: 5/hour per IP and per email) ─────────
-- Keys are hashed server-side (e.g. 'ip:<sha256>', 'email:<sha256>'); no raw IPs or emails stored.
create table rate_limits (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_limits_key_created_idx on rate_limits (key, created_at);
create index rate_limits_created_idx on rate_limits (created_at);
alter table rate_limits enable row level security; -- no policies: service role only

-- Records a hit and returns true if the key is still under p_limit within p_window.
-- The advisory lock makes check + insert atomic per key.
create or replace function hit_rate_limit(p_key text, p_limit int, p_window interval)
returns boolean language plpgsql set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  -- Prune every expired row, not just this key's, so hashes don't outlive the window (privacy policy).
  delete from rate_limits where created_at < now() - p_window;
  select count(*) into n from rate_limits where key = p_key;
  if n >= p_limit then return false; end if;
  insert into rate_limits (key) values (p_key);
  return true;
end $$;
revoke all on function hit_rate_limit(text, int, interval) from public, anon, authenticated;

-- ───────── Auth: one profile row per user ─────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────── Owners may edit content columns only ─────────
-- The original "owner update" check (is_verified = false) validated the new row,
-- so owners of verified or featured agencies could never save. Column privileges protect the
-- admin-only fields (status, flags, owner_id, slug, website) instead. Admin writes use the service role.
drop policy "owner update" on agencies;
create policy "owner update" on agencies for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke update on agencies from anon, authenticated;
grant update (tagline, description, logo_path, min_budget_usd, pricing_model, team_size,
  founded_year, languages, hq_location_id, updated_at) on agencies to authenticated;

-- anon (the public anon key) reads every agencies column except owner_id, so visitors can't
-- learn which account owns a listing. New agencies columns must be added to this grant.
revoke select on agencies from anon;
grant select (id, slug, name, tagline, description, website, logo_path, founded_year, team_size,
  min_budget_usd, pricing_model, languages, hq_location_id, status, is_claimed, is_verified,
  search, created_at, updated_at) on agencies to anon;

-- One open claim per user per agency.
create unique index claims_one_pending on claims (agency_id, user_id) where status = 'pending';

-- ───────── Storage: agency logos (SECURITY.md) ─────────
-- Public read for logos; owners write only to agencies/<their agency id>/. png/jpg/webp, max 2 MB.
-- The server action also checks file signatures, since the declared type can't be trusted.
-- objects.name must be qualified: inside the subquery a bare `name` would resolve to agencies.name.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agency-media', 'agency-media', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage's remove() and upsert filter rows as the user, so they also need a SELECT policy.
-- Without it, deleting an old logo silently matches nothing.
create policy "owners read own agency folder" on storage.objects for select to authenticated
  using (bucket_id = 'agency-media' and (storage.foldername(objects.name))[1] = 'agencies' and exists (
    select 1 from public.agencies a where a.id::text = (storage.foldername(objects.name))[2] and a.owner_id = auth.uid()));
create policy "owners write own agency folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'agency-media' and (storage.foldername(name))[1] = 'agencies' and exists (
    select 1 from public.agencies a where a.id::text = (storage.foldername(objects.name))[2] and a.owner_id = auth.uid()));
create policy "owners update own agency folder" on storage.objects for update to authenticated
  using (bucket_id = 'agency-media' and (storage.foldername(name))[1] = 'agencies' and exists (
    select 1 from public.agencies a where a.id::text = (storage.foldername(objects.name))[2] and a.owner_id = auth.uid()));
create policy "owners delete own agency folder" on storage.objects for delete to authenticated
  using (bucket_id = 'agency-media' and (storage.foldername(name))[1] = 'agencies' and exists (
    select 1 from public.agencies a where a.id::text = (storage.foldername(objects.name))[2] and a.owner_id = auth.uid()));

-- ───────── updated_at: kept current by triggers (sitemap lastmod, docs/SEO.md) ─────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger set_updated_at before update on agencies for each row execute function set_updated_at();
create trigger set_updated_at before update on services for each row execute function set_updated_at();
create trigger set_updated_at before update on industries for each row execute function set_updated_at();
create trigger set_updated_at before update on service_industry_content for each row execute function set_updated_at();
create trigger set_updated_at before update on case_studies for each row execute function set_updated_at();
create trigger set_updated_at before update on reviews for each row execute function set_updated_at();

-- A profile shows its services, industries, locations, case studies and published reviews, so changes
-- to those bump the agency's updated_at (its sitemap lastmod and directory page dates).
-- security definer: it only sets updated_at, and must work whichever role made the change.
create or replace function touch_agency() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'reviews' then
    -- Pending or rejected reviews aren't shown, so only count changes that involve a published one.
    if not ((tg_op <> 'DELETE' and new.status = 'published') or (tg_op <> 'INSERT' and old.status = 'published')) then
      return null;
    end if;
  end if;
  update agencies set updated_at = now()
  where id = case when tg_op = 'DELETE' then old.agency_id else new.agency_id end;
  return null;
end $$;

create trigger touch_agency after insert or update or delete on agency_services for each row execute function touch_agency();
create trigger touch_agency after insert or update or delete on agency_industries for each row execute function touch_agency();
create trigger touch_agency after insert or update or delete on agency_locations for each row execute function touch_agency();
create trigger touch_agency after insert or update or delete on case_studies for each row execute function touch_agency();
create trigger touch_agency after insert or update or delete on reviews for each row execute function touch_agency();

-- ───────── Agency submissions (/list-your-agency) ─────────
-- A signed-in user can submit an agency that isn't listed. It's a draft with no owner: owner_id is
-- only set once the work email is confirmed on the website's domain (claims flow) or an admin
-- approves the submission. submitted_by is not in anon's column grant, like owner_id.
alter table agencies add column if not exists submitted_by uuid references auth.users(id) on delete set null;
create index if not exists agencies_submitted_by_idx on agencies (submitted_by) where submitted_by is not null;

-- Users may provide content columns only. status, owner_id, is_claimed and is_verified
-- keep their defaults (draft, null, false), so a user can't publish, own, verify or feature on insert.
-- Admin inserts use the service role.
revoke insert on agencies from anon, authenticated;
grant insert (id, slug, name, website, description, min_budget_usd, submitted_by) on agencies to authenticated;

-- Belt and braces on top of the grants, plus a cap of 3 open submissions per account.
create policy "submit draft" on agencies for insert to authenticated with check (
  submitted_by = auth.uid() and status = 'draft' and owner_id is null
  and not is_claimed and not is_verified
  and (select count(*) from agencies a where a.submitted_by = auth.uid() and a.status = 'draft') < 3);

-- Submitters can see their own submission (needed for the checks below and their dashboard).
alter policy "read published or own" on agencies
  using (status = 'published' or owner_id = auth.uid() or submitted_by = auth.uid() or is_admin());

-- Submitters can attach services, industries and locations to their own unowned draft, nothing else.
create policy "submitter adds to own draft" on agency_services for insert to authenticated with check (
  exists (select 1 from agencies a where a.id = agency_id and a.submitted_by = auth.uid() and a.status = 'draft' and a.owner_id is null));
create policy "submitter adds to own draft" on agency_industries for insert to authenticated with check (
  exists (select 1 from agencies a where a.id = agency_id and a.submitted_by = auth.uid() and a.status = 'draft' and a.owner_id is null));
create policy "submitter adds to own draft" on agency_locations for insert to authenticated with check (
  exists (select 1 from agencies a where a.id = agency_id and a.submitted_by = auth.uid() and a.status = 'draft' and a.owner_id is null));

-- ───────── Plans, verifications, events, audit (ADMIN_V2_SPEC §7) ─────────
-- Admins write everything (the app uses the service role after an admin check). Owners read their
-- own subscription, verification and daily event rollups. Anon reads none of these.
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

-- ───────── Admin agencies list (ADMIN_V2_SPEC §5.2) ─────────
-- Owner-rights view across subscriptions and lead routes: service role only.
create or replace view admin_agency_list as
select
  a.id, a.name, a.slug, a.website, a.logo_path, a.status, a.is_claimed, a.is_verified,
  a.created_at, a.updated_at,
  coalesce((
    select s.plan_id from agency_subscriptions s
    where s.agency_id = a.id and s.status = 'active' and s.starts_at <= now()
      and (s.ends_at is null or s.ends_at > now())
    limit 1
  ), 'free') as plan,
  (select count(*) from lead_routes r
   where r.agency_id = a.id and r.sent_at >= now() - interval '30 days')::int as leads_30d,
  array(select ags.service_id from agency_services ags where ags.agency_id = a.id) as service_ids,
  array(select agi.industry_id from agency_industries agi where agi.agency_id = a.id) as industry_ids
from agencies a;

revoke all on admin_agency_list from public, anon, authenticated;
grant select on admin_agency_list to service_role;
