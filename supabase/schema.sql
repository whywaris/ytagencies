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
  -- One line under the H1 (≤ ~160 chars shown); empty uses the intro's first sentence.
  summary text check (char_length(summary) <= 200),
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
  -- Pricing details (forms require them, setup fee optional; null = not filled in yet).
  min_contract text check (min_contract in ('none', '1_month', '3_months', '6_months', '12_months')),
  ad_spend text check (ad_spend in ('separate', 'included', 'not_applicable')),
  setup_fee_usd int check (setup_fee_usd between 0 and 9999999),
  languages text[] default '{}',
  hq_location_id int references locations(id),
  -- A submitted HQ city we don't list yet; an admin maps it to a location.
  hq_other text check (char_length(hq_other) between 1 and 100),
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
  -- channel_url resolved to a channel ID when saved (lib/case-studies.ts); the home hero matches on it.
  channel_id text check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
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
  -- '1k-5k' is from before the $1k–3k / $3k–5k split.
  budget_range text constraint leads_budget_range_check check (
    budget_range in ('under-1k', '1k-3k', '3k-5k', '5k-10k', '10k-plus', 'not-sure', '1k-5k')
  ),
  message text,
  -- Where a Get matched request started, e.g. "profile:<slug>" (an unmanaged profile's button).
  ref text check (ref ~ '^[a-z]+(:[a-z0-9-]{1,80})?$'),
  -- Get matched step 1 (goal, start) and step 2 (business details), all optional in the table.
  goal text check (goal in ('leads-sales', 'views-subs', 'brand', 'not-sure')),
  start_timeline text check (start_timeline in ('asap', 'this-month', 'exploring')),
  business_url text check (char_length(business_url) <= 300),
  channel_url text check (char_length(channel_url) <= 300),
  customer_location text check (char_length(customer_location) <= 120),
  prior_agency text check (prior_agency in ('first', 'went-well', 'didnt-work')),
  created_at timestamptz not null default now()
);

create table lead_routes (               -- which agencies received which lead
  lead_id uuid references leads(id) on delete cascade,
  agency_id uuid references agencies(id) on delete cascade,
  sent_at timestamptz not null default now(),
  -- Marked by the agency owner (server time, set once: lead_route_contacted trigger).
  contacted_at timestamptz,
  -- The one "a business is waiting for your reply" email (daily cron).
  reminded_at timestamptz,
  primary key (lead_id, agency_id)
);

create table claims (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  work_email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  -- Proof for a claim without a matching work email (reviewed by an admin).
  role text check (char_length(role) <= 100),
  linkedin_url text check (char_length(linkedin_url) <= 300),
  note text check (char_length(note) <= 1000),
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

-- Owners mark their routed leads as contacted; response times are published only as an aggregate.
revoke update on lead_routes from anon, authenticated;
grant update (contacted_at) on lead_routes to authenticated;
create policy "owner marks contacted" on lead_routes for update to authenticated
  using (exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));

create or replace function lead_route_contacted() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.contacted_at is not null then
    new.contacted_at := old.contacted_at; -- set once
  elsif new.contacted_at is not null then
    new.contacted_at := greatest(now(), new.sent_at); -- the server's clock, never the caller's
  end if;
  return new;
end $$;
create trigger lead_route_contacted before update of contacted_at on lead_routes
  for each row execute function lead_route_contacted();

-- Runs as its owner (not security_invoker) on purpose: it publishes only this aggregate.
create view agency_response_times as
select r.agency_id,
  round(percentile_cont(0.5) within group (
    order by extract(epoch from (r.contacted_at - r.sent_at)) / 60))::int as median_minutes,
  count(*)::int as contacted
from lead_routes r
join agencies a on a.id = r.agency_id
where a.status = 'published'
  and r.contacted_at is not null
  and r.sent_at >= now() - interval '90 days'
group by r.agency_id
having count(*) >= 3
  and percentile_cont(0.5) within group (
    order by extract(epoch from (r.contacted_at - r.sent_at))) < 48 * 3600;
revoke all on agency_response_times from public, anon, authenticated;
grant select on agency_response_times to anon, authenticated, service_role;


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
  founded_year, languages, hq_location_id, updated_at, min_contract, ad_spend, setup_fee_usd)
  on agencies to authenticated;

-- anon (the public anon key) reads every agencies column except owner_id, so visitors can't
-- learn which account owns a listing. New agencies columns must be added to this grant.
revoke select on agencies from anon;
grant select (id, slug, name, tagline, description, website, logo_path, founded_year, team_size,
  min_budget_usd, pricing_model, languages, hq_location_id, status, is_claimed, is_verified,
  search, created_at, updated_at, min_contract, ad_spend, setup_fee_usd) on agencies to anon;

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
grant insert (id, slug, name, website, description, min_budget_usd, pricing_model, submitted_by,
  min_contract, ad_spend, setup_fee_usd, hq_location_id, hq_other) on agencies to authenticated;

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
  -- One plan: Pro. Listings are free; managing one needs Pro (migration 20261020000100 removed
  -- Founding and Free). Named 'pro' so it can't be confused with the Verified badge.
  id text primary key check (id in ('pro')),
  name text not null,
  price_monthly numeric(10, 2),
  price_yearly numeric(10, 2)
);
insert into plans (id, name, price_monthly, price_yearly) values
  ('pro', 'Pro', 29, 279)
on conflict (id) do update set name = excluded.name, price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly;

-- ───────── Subscriptions ─────────
-- Managed = a live Pro subscription (lib/entitlements.ts): active in date (incl. cancelling at
-- the period end), or past_due for up to 7 days. Otherwise the listing is unmanaged.
-- One live (active or past_due) row per agency.
create table agency_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  plan_id text not null references plans(id),
  status text not null default 'active'
    check (status in ('active', 'past_due', 'expired', 'cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  source text not null check (source in ('manual', 'payment')),
  external_id text,
  cancel_at_period_end boolean not null default false,
  past_due_since timestamptz,
  -- Creem (lib/billing): interval, customer (for the portal), last applied event, 3-day notice.
  billing_interval text check (billing_interval in ('month', 'year')),
  customer_id text check (char_length(customer_id) <= 200),
  last_event_at timestamptz,
  ending_notice_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  constraint agency_subscriptions_past_due check (status <> 'past_due' or past_due_since is not null)
);
create unique index agency_subscriptions_one_active on agency_subscriptions (agency_id)
  where status in ('active', 'past_due');
create index agency_subscriptions_ends_at_idx on agency_subscriptions (ends_at) where status = 'active';
create unique index agency_subscriptions_external_id on agency_subscriptions (external_id)
  where source = 'payment';

-- Managed (lib/entitlements.ts) in SQL: live Pro, active in its dates or past due within 7 days.
create or replace function agency_managed(p_agency uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from agency_subscriptions s
    where s.agency_id = p_agency
      and s.plan_id = 'pro'
      and s.starts_at <= now()
      and (
        (s.status = 'active' and (s.ends_at is null or s.ends_at > now()))
        or (s.status = 'past_due' and s.past_due_since > now() - interval '7 days')
      )
  )
$$;
revoke execute on function agency_managed(uuid) from public, anon;
grant execute on function agency_managed(uuid) to authenticated;

-- Marking inquiries as contacted only while managed: a lapsed owner still reads past inquiries
-- (the read policy) but can't change them.
drop policy "owner marks contacted" on lead_routes;
create policy "owner marks contacted" on lead_routes for update to authenticated
  using (agency_managed(agency_id)
    and exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()))
  with check (agency_managed(agency_id)
    and exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));


-- Creem webhook events, by Creem event id: retries are skipped once processed.
create table billing_events (
  id text primary key check (char_length(id) between 1 and 200),
  type text not null check (char_length(type) between 1 and 100),
  agency_id uuid references agencies(id) on delete set null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index billing_events_agency_idx on billing_events (agency_id, received_at desc);

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
  -- Website clicks: where the link was (its utm_content). '' for other types.
  source text not null default '' check (source in ('', 'profile', 'directory', 'home_hero', 'guide')),
  created_at timestamptz not null default now()
);
create unique index agency_events_once_per_visitor on agency_events (agency_id, type, visitor_hash);
create index agency_events_created_at_idx on agency_events (created_at);

create table agency_event_daily (
  agency_id uuid not null references agencies(id) on delete cascade,
  day date not null,
  type text not null check (type in ('profile_view', 'website_click', 'contact_open', 'inquiry')),
  source text not null default '' check (source in ('', 'profile', 'directory', 'home_hero', 'guide')),
  count int not null default 0 check (count >= 0),
  primary key (agency_id, day, type, source)
);

-- The only way events are written: dedupes, bumps the rollup, prunes raw rows past 90 days.
-- Service role only (the beacon endpoint and the lead_routes trigger).
create or replace function record_agency_event(
  p_agency uuid, p_type text, p_path text, p_visitor text, p_source text default ''
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  added int;
begin
  insert into agency_events (agency_id, type, page_path, visitor_hash, source)
  values (p_agency, p_type, left(p_path, 300), p_visitor, p_source)
  on conflict (agency_id, type, visitor_hash) do nothing;
  get diagnostics added = row_count;
  if added = 0 then
    return false;
  end if;
  insert into agency_event_daily (agency_id, day, type, source, count)
  values (p_agency, (now() at time zone 'utc')::date, p_type, p_source, 1)
  on conflict (agency_id, day, type, source) do update set count = agency_event_daily.count + 1;
  delete from agency_events where created_at < now() - interval '90 days';
  return true;
end $$;
revoke execute on function record_agency_event(uuid, text, text, text, text) from public, anon, authenticated;

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

alter table billing_events enable row level security;
revoke all on billing_events from anon, authenticated;
grant select on billing_events to authenticated;
create policy "admin read" on billing_events for select to authenticated using (is_admin());

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

-- ───────── Guides CMS (ADMIN_V2_SPEC §8) ─────────
create table authors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(name) between 1 and 100),
  role text check (char_length(role) <= 100),
  bio text check (char_length(bio) <= 300),
  avatar_path text,
  linkedin_url text check (linkedin_url ~ '^https://' and char_length(linkedin_url) <= 300),
  x_url text check (x_url ~ '^https://' and char_length(x_url) <= 300),
  website_url text check (website_url ~ '^https://' and char_length(website_url) <= 300),
  -- For future contributor accounts. Never exposed to the public (see the column grants below).
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on authors for each row execute function set_updated_at();

create table guides (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 1 and 200),
  excerpt text check (char_length(excerpt) <= 300),
  -- Backup of the Markdown body from before the Tiptap editor; read-only.
  body_md text not null default '' check (char_length(body_md) <= 100000),
  -- Live content: Tiptap JSON and the sanitized HTML rendered from it (lib/guide-content.ts).
  body_json jsonb,
  body_html text check (char_length(body_html) <= 400000),
  -- Unpublished edits of a live guide; admin-only (column grants below).
  draft_json jsonb,
  draft_html text check (char_length(draft_html) <= 400000),
  -- The other fields of the unpublished changes (title, SEO, cover…), as guide columns.
  draft_meta jsonb,
  draft_updated_at timestamptz,
  -- When the live content last changed ("Updated" on the page, Article dateModified).
  content_updated_at timestamptz,
  cover_path text,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  author_id uuid references authors(id) on delete set null,
  -- in_review: for future contributor submissions (no UI yet); never public, like drafts.
  status text not null default 'draft' check (status in ('draft', 'in_review', 'scheduled', 'published')),
  published_at timestamptz,
  related_combos jsonb not null default '[]',
  key_takeaways text[] not null default '{}'
    check (cardinality(key_takeaways) <= 5 and char_length(array_to_string(key_takeaways, '')) <= 1000),
  numbered_sections boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('draft', 'in_review') or published_at is not null)
);
create index guides_author_idx on guides (author_id);
create index guides_live_idx on guides (published_at) where status in ('published', 'scheduled');
create trigger set_updated_at before update on guides for each row execute function set_updated_at();

-- Old slugs of guides whose URL changed ("Change URL" in the editor). /guides/<old> redirects
-- permanently to the guide's current slug.
create table guide_redirects (
  from_slug text primary key check (from_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  guide_id uuid not null references guides(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table guides enable row level security;
alter table guide_redirects enable row level security;

-- Live = published, or scheduled with its time passed. Everyone may read live guides (the
-- public pages use the anon key); drafts and future ones are admin-only.
create policy "read live guides" on guides for select
  using ((status in ('published', 'scheduled') and published_at <= now()) or is_admin());
create policy "admin write" on guides for all to authenticated using (is_admin()) with check (is_admin());
-- Drafts are never public: every column but the draft ones (admin pages use the service role).
revoke select on guides from anon, authenticated;
grant select (id, slug, title, excerpt, cover_path, seo_title, seo_description, author_id, status,
  published_at, related_combos, key_takeaways, numbered_sections, created_at, updated_at,
  body_json, body_html, content_updated_at, body_md)
  on guides to anon, authenticated;

-- Guide images and covers: public read, admin-only write, jpg/png/webp/gif up to 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guide-media', 'guide-media', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy "admins read guide media" on storage.objects for select to authenticated
  using (bucket_id = 'guide-media' and is_admin());
create policy "admins write guide media" on storage.objects for insert to authenticated
  with check (bucket_id = 'guide-media' and is_admin());
create policy "admins update guide media" on storage.objects for update to authenticated
  using (bucket_id = 'guide-media' and is_admin()) with check (bucket_id = 'guide-media' and is_admin());
create policy "admins delete guide media" on storage.objects for delete to authenticated
  using (bucket_id = 'guide-media' and is_admin());
-- A redirect is only readable once its target is live, so it can't leak an unpublished slug.
create policy "read live redirects" on guide_redirects for select using (
  exists (select 1 from guides g where g.id = guide_id
          and ((g.status in ('published', 'scheduled') and g.published_at <= now()) or is_admin())));
create policy "admin write" on guide_redirects for all to authenticated using (is_admin()) with check (is_admin());

alter table authors enable row level security;
-- Column grants: the public (anon key) and signed-in users can't read user_id at all.
revoke all on authors from anon, authenticated;
grant select (id, slug, name, role, bio, avatar_path, linkedin_url, x_url, website_url, created_at,
  updated_at) on authors to anon, authenticated;
grant insert, update, delete on authors to authenticated;
-- Public: only authors with at least one live guide (published, or scheduled with its time passed).
create policy "read authors of live guides" on authors for select using (
  exists (select 1 from guides g where g.author_id = authors.id
          and g.status in ('published', 'scheduled') and g.published_at <= now())
  or is_admin());
create policy "admin write" on authors for all to authenticated using (is_admin()) with check (is_admin());


-- ───────── Settings (ADMIN_V2_SPEC §5.10) ─────────
create table app_settings (
  id boolean primary key default true check (id),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on app_settings for each row execute function set_updated_at();
insert into app_settings default values;

alter table app_settings enable row level security;
-- Public pages read it server-side with the service role (§7); anon gets nothing.
revoke all on app_settings from anon;
create policy "admin read" on app_settings for select to authenticated using (is_admin());
-- Update only: the single row can't be deleted or duplicated.
create policy "admin update" on app_settings for update to authenticated using (is_admin()) with check (is_admin());

-- ───────── Contact messages (/contact, Admin → Inbox) ─────────
create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic in ('general', 'agencies', 'report', 'press', 'privacy', 'pro', 'access')),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) <= 254),
  message text not null check (char_length(message) between 1 and 5000),
  -- "Report a listing": the profile URL being reported.
  agency_url text check (char_length(agency_url) <= 300),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index contact_messages_open_idx on contact_messages (created_at) where status = 'open';

alter table contact_messages enable row level security;
-- No public access at all: not even insert (the server action uses the service role).
revoke all on contact_messages from anon;
create policy "admin all" on contact_messages for all to authenticated
  using (is_admin()) with check (is_admin());

-- ───────── Agency delete (admin) ─────────
-- Leads outlive deleted agencies: their routes are copied here with the agency's name first.
create table deleted_agency_routes (
  lead_id uuid not null references leads(id) on delete cascade,
  -- The deleted agency's id; no foreign key, because the agency is gone.
  agency_id uuid not null,
  agency_name text not null,
  agency_slug text not null,
  sent_at timestamptz not null,
  deleted_at timestamptz not null default now(),
  primary key (lead_id, agency_id)
);

alter table deleted_agency_routes enable row level security;
revoke all on deleted_agency_routes from anon;
create policy "admin read" on deleted_agency_routes for select to authenticated using (is_admin());

-- One transaction: copy the route history, then delete (cascades do the rest). Returns what was
-- deleted. Only the service role may run it; the server action checks the admin first.
create or replace function delete_agencies(p_ids uuid[])
returns table (id uuid, name text, slug text)
language plpgsql set search_path = public as $$
begin
  insert into deleted_agency_routes (lead_id, agency_id, agency_name, agency_slug, sent_at)
  select r.lead_id, a.id, a.name, a.slug, r.sent_at
  from lead_routes r join agencies a on a.id = r.agency_id
  where a.id = any(p_ids)
  on conflict do nothing;
  return query delete from agencies a where a.id = any(p_ids) returning a.id, a.name, a.slug;
end $$;
revoke all on function delete_agencies(uuid[]) from public, anon, authenticated;
grant execute on function delete_agencies(uuid[]) to service_role;

-- ───────── Agency profile data (migration 20261019000100) ─────────
-- Text arrays: every item at most n characters (used by check constraints).
create or replace function text_items_within(items text[], n int) returns boolean
language sql immutable as $$
  select coalesce(bool_and(char_length(i) <= n), true) from unnest(items) i
$$;

-- ───────── 1. agencies ─────────
alter table agencies
  add column best_for text check (char_length(best_for) <= 120),
  add column timezone text check (char_length(timezone) <= 60),
  add column youtube_channel_url text
    check (youtube_channel_url ~ '^https://' and char_length(youtube_channel_url) <= 300),
  add column linkedin_url text check (linkedin_url ~ '^https://' and char_length(linkedin_url) <= 300),
  add column reporting_frequency text check (reporting_frequency in ('weekly', 'biweekly', 'monthly')),
  add column process jsonb not null default '[]'
    check (jsonb_typeof(process) = 'array' and jsonb_array_length(process) <= 5),
  add column seo_title text check (char_length(seo_title) <= 70),
  add column seo_description text check (char_length(seo_description) <= 200);

grant select (best_for, timezone, youtube_channel_url, linkedin_url, reporting_frequency, process,
  seo_title, seo_description) on agencies to anon;
-- Owners and submitters: content columns only. seo_title / seo_description are admin-only.
grant update (best_for, timezone, youtube_channel_url, linkedin_url, reporting_frequency, process)
  on agencies to authenticated;
grant insert (best_for, timezone, youtube_channel_url, linkedin_url, reporting_frequency, process)
  on agencies to authenticated;

-- ───────── 2. services and industries ─────────
alter table agency_services
  add column focus_pct int check (focus_pct between 0 and 100),
  add column included text[] not null default '{}'
    check (cardinality(included) <= 6 and text_items_within(included, 50)),
  add column starting_price int check (starting_price between 0 and 9999999),
  add column price_unit text check (price_unit in ('retainer', 'per_video', 'performance', 'project'));
alter table agency_industries add column focus_pct int check (focus_pct between 0 and 100);

-- ───────── 3. agency_channels ─────────
create table agency_channels (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  channel_url text not null check (channel_url ~ '^https://' and char_length(channel_url) <= 300),
  -- Resolved once on save (YouTube Data API, server-side), refreshed by the monthly stats cron.
  channel_id text check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  title text check (char_length(title) <= 200),
  subscriber_count bigint check (subscriber_count >= 0),
  stats_checked_at timestamptz,
  industry_id int references industries(id) on delete set null,
  -- 'confirmed': the client confirmed the agency worked on it (admin sets it).
  status text not null default 'listed' check (status in ('listed', 'confirmed')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, channel_url)
);
create index agency_channels_agency_idx on agency_channels (agency_id);
create trigger set_updated_at before update on agency_channels
  for each row execute function set_updated_at();
create trigger touch_agency after insert or update or delete on agency_channels
  for each row execute function touch_agency();

-- At most 6 per agency.
create or replace function agency_channels_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from agency_channels where agency_id = new.agency_id) >= 6 then
    raise exception 'An agency can list up to 6 channels' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger agency_channels_limit before insert on agency_channels
  for each row execute function agency_channels_limit();

-- A changed link is a different channel: its resolved data and any confirmation no longer apply.
create or replace function agency_channels_url_changed() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.channel_url is distinct from old.channel_url then
    new.channel_id := null;
    new.title := null;
    new.subscriber_count := null;
    new.stats_checked_at := null;
    new.status := 'listed';
    new.confirmed_at := null;
  end if;
  return new;
end $$;
create trigger agency_channels_url_changed before update on agency_channels
  for each row execute function agency_channels_url_changed();

alter table agency_channels enable row level security;
create policy "public read published" on agency_channels for select using (
  exists (select 1 from agencies a where a.id = agency_id and a.status = 'published'));
create policy "owner read" on agency_channels for select to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()) or is_admin());
create policy "owner insert" on agency_channels for insert to authenticated with check (
  exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));
create policy "owner update" on agency_channels for update to authenticated
  using (exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));
create policy "owner delete" on agency_channels for delete to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));
revoke all on agency_channels from anon, authenticated;
grant select on agency_channels to anon, authenticated;
-- Owners write the link and its industry only; status, confirmed_at and the YouTube data are set
-- by the server (service role) after an ownership check.
grant insert (agency_id, channel_url, industry_id) on agency_channels to authenticated;
grant update (channel_url, industry_id) on agency_channels to authenticated;
grant delete on agency_channels to authenticated;

-- Existing case-study channel links, up to 6 per agency, newest first.
insert into agency_channels (agency_id, channel_url, channel_id)
select agency_id, channel_url, channel_id from (
  select agency_id, channel_url, channel_id,
    row_number() over (partition by agency_id order by created_at desc) as n
  from (
    select distinct on (agency_id, channel_url) agency_id, channel_url, channel_id, created_at
    from case_studies
    where channel_url ~ '^https://' and char_length(channel_url) <= 300
    order by agency_id, channel_url, created_at desc
  ) d
) ranked
where n <= 6
on conflict (agency_id, channel_url) do nothing;

-- ───────── 4. case_studies ─────────
alter table case_studies add column service_id int references services(id) on delete set null;
alter table case_studies alter column metrics drop default;
-- {"subs_after": 45000, "roas": 3.2, "revenue_usd": 12000} → [{"value":"45000","label":"Subs after"}, …]
update case_studies cs set metrics = coalesce((
  select jsonb_agg(jsonb_build_object('value', v, 'label', l) order by k)
  from (
    select e.key as k,
      left(case
        when e.key ~ '_pct$' then n || '%'
        when e.key ~ '_usd$' then '$' || n
        when e.key ~ '_gbp$' then '£' || n
        when e.key ~ '^roas' then n || '×'
        else n end, 12) as v,
      left(upper(left(lbl, 1)) || substr(lbl, 2), 40) as l
    from jsonb_each_text(cs.metrics) e,
      -- "45000" → "45,000"; ROAS, CTR, CPA, CPM, CPV and ROI in capitals.
      lateral (select
        case when e.value ~ '^\d{4,}$' then to_char(e.value::bigint, 'FM999,999,999,999') else e.value end as n,
        trim(replace(replace(replace(replace(replace(replace(
          ' ' || regexp_replace(regexp_replace(e.key, '_(pct|usd|gbp)$', ''), '_', ' ', 'g') || ' ',
          ' roas ', ' ROAS '), ' ctr ', ' CTR '), ' cpa ', ' CPA '), ' cpm ', ' CPM '), ' cpv ', ' CPV '),
          ' roi ', ' ROI ')) as lbl) x
    order by e.key
    limit 3
  ) t), '[]'::jsonb)
where jsonb_typeof(cs.metrics) = 'object';
update case_studies set metrics = '[]' where metrics is null or jsonb_typeof(metrics) <> 'array';
alter table case_studies
  alter column metrics set default '[]',
  alter column metrics set not null,
  add constraint case_studies_metrics_shape
    check (jsonb_typeof(metrics) = 'array' and jsonb_array_length(metrics) <= 3);

-- ───────── 5. reviews ─────────
alter table reviews
  add column service_id int references services(id) on delete set null,
  add column budget_range text check (budget_range in ('under_10k', '10k_50k', '50k_200k', '200k_plus')),
  add column project_start date,
  add column project_end date,
  add column score_quality numeric(2,1) check (score_quality between 1 and 5 and score_quality * 2 = trunc(score_quality * 2)),
  add column score_schedule numeric(2,1) check (score_schedule between 1 and 5 and score_schedule * 2 = trunc(score_schedule * 2)),
  add column score_cost numeric(2,1) check (score_cost between 1 and 5 and score_cost * 2 = trunc(score_cost * 2)),
  add column score_refer numeric(2,1) check (score_refer between 1 and 5 and score_refer * 2 = trunc(score_refer * 2)),
  add column reviewer_title text check (char_length(reviewer_title) <= 100),
  add column reviewer_industry_id int references industries(id) on delete set null,
  add column reviewer_company_size text check (reviewer_company_size in ('1-10', '11-50', '51-200', '200+')),
  add column reviewer_country text check (char_length(reviewer_country) <= 60),
  add column lead_id uuid references leads(id) on delete set null,
  add constraint reviews_project_dates check (project_end is null or project_end >= project_start);
alter table reviews
  add column overall numeric(3,2) generated always as (
    round((score_quality + score_schedule + score_cost + score_refer) / 4, 2)) stored,
  add column verified_client boolean generated always as (lead_id is not null) stored;

-- Anon reads published reviews, but not which lead (or account) wrote them.
revoke select on reviews from anon;
grant select (id, agency_id, author_name, author_company, rating, body, status, created_at,
  updated_at, service_id, budget_range, project_start, project_end, score_quality, score_schedule,
  score_cost, score_refer, overall, reviewer_title, reviewer_industry_id, reviewer_company_size,
  reviewer_country, verified_client) on reviews to anon;

-- ───────── Directory page views (agency dashboard, /list-your-agency) ─────────
create table page_view_events (
  id bigint generated always as identity primary key,
  -- "/<service>-agencies" or "/<service>-agencies/(for|in)-<slug>"
  path text not null check (path ~ '^/[a-z0-9-]{1,80}-agencies(/(for|in)-[a-z0-9-]{1,80})?$'),
  visitor_hash text not null check (char_length(visitor_hash) <= 128),
  created_at timestamptz not null default now()
);
create unique index page_view_events_once_per_visitor on page_view_events (path, visitor_hash);
create index page_view_events_created_at_idx on page_view_events (created_at);

create table page_view_daily (
  path text not null check (path ~ '^/[a-z0-9-]{1,80}-agencies(/(for|in)-[a-z0-9-]{1,80})?$'),
  day date not null,
  count int not null default 0 check (count >= 0),
  primary key (path, day)
);
create index page_view_daily_day_idx on page_view_daily (day);

create or replace function record_page_view(p_path text, p_visitor text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  added int;
begin
  insert into page_view_events (path, visitor_hash) values (p_path, p_visitor)
  on conflict (path, visitor_hash) do nothing;
  get diagnostics added = row_count;
  if added = 0 then
    return false;
  end if;
  insert into page_view_daily (path, day, count)
  values (p_path, (now() at time zone 'utc')::date, 1)
  on conflict (path, day) do update set count = page_view_daily.count + 1;
  delete from page_view_events where created_at < now() - interval '90 days';
  return true;
end $$;
revoke execute on function record_page_view(text, text) from public, anon, authenticated;

alter table page_view_events enable row level security;
alter table page_view_daily enable row level security;
revoke all on page_view_events, page_view_daily from anon, authenticated;
grant select on page_view_daily to authenticated;
create policy "admin read" on page_view_daily for select to authenticated using (is_admin());
