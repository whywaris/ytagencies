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
  sort_order int default 0
);

create table industries (
  id serial primary key,
  slug text unique not null,            -- doctors
  name text not null,                   -- Doctors & clinics
  intro text,
  sort_order int default 0
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
  is_featured boolean not null default false,
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
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
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
create policy "public read published" on agencies for select
  using (status = 'published' or owner_id = auth.uid() or is_admin());
create policy "owner update" on agencies for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and is_featured = false and is_verified = false); -- paid/verified flags are admin-only
create policy "admin all" on agencies for all using (is_admin()) with check (is_admin());

-- Agency join tables & case studies: public read if agency is published; owner manages
create policy "public read" on agency_services for select using (
  exists (select 1 from agencies a where a.id = agency_id and (a.status = 'published' or a.owner_id = auth.uid() or is_admin())));
create policy "owner manage" on agency_services for all using (
  exists (select 1 from agencies a where a.id = agency_id and (a.owner_id = auth.uid() or is_admin())));

create policy "public read" on agency_industries for select using (
  exists (select 1 from agencies a where a.id = agency_id and (a.status = 'published' or a.owner_id = auth.uid() or is_admin())));
create policy "owner manage" on agency_industries for all using (
  exists (select 1 from agencies a where a.id = agency_id and (a.owner_id = auth.uid() or is_admin())));

create policy "public read" on agency_locations for select using (
  exists (select 1 from agencies a where a.id = agency_id and (a.status = 'published' or a.owner_id = auth.uid() or is_admin())));
create policy "owner manage" on agency_locations for all using (
  exists (select 1 from agencies a where a.id = agency_id and (a.owner_id = auth.uid() or is_admin())));

create policy "public read" on case_studies for select using (
  exists (select 1 from agencies a where a.id = agency_id and (a.status = 'published' or a.owner_id = auth.uid() or is_admin())));
create policy "owner manage" on case_studies for all using (
  exists (select 1 from agencies a where a.id = agency_id and (a.owner_id = auth.uid() or is_admin())));

-- Reviews: public sees published; inserts go through a server action (Turnstile + rate limit)
create policy "public read published" on reviews for select using (status = 'published' or is_admin());
create policy "admin moderate" on reviews for all using (is_admin()) with check (is_admin());

-- Leads: never public. Inserted server-side with the service role after Turnstile + rate limit.
create policy "admin read" on leads for select using (is_admin());
create policy "agency reads routed leads" on leads for select using (
  exists (select 1 from lead_routes lr join agencies a on a.id = lr.agency_id
          where lr.lead_id = leads.id and a.owner_id = auth.uid()));
create policy "agency reads own routes" on lead_routes for select using (
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
