-- Data for the new agency profile. schema.sql has the same objects for fresh projects.
-- Nothing here is required, so existing agencies keep working.
--
-- 1. agencies: best_for, timezone, youtube_channel_url, linkedin_url, reporting_frequency,
--    process (0–5 steps); seo_title / seo_description are admin-only (no owner grant).
-- 2. agency_services: focus_pct, included (0–6 items), starting_price + price_unit.
--    agency_industries: focus_pct. Totals of 100 are checked in the forms, not here.
-- 3. agency_channels: channels an agency worked on (max 6). Owners add, edit and delete their
--    own; status / confirmed_at and the resolved YouTube data are set by the server only.
--    Existing case-study channel links are copied in as 'listed'.
-- 4. case_studies: service_id; metrics become up to 3 {value, label} (converted below; any past
--    the third are dropped).
-- 5. reviews: Clutch-style fields, overall (average of the four scores) and verified_client
--    (generated). lead_id is hidden from anon.

begin;

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

commit;
