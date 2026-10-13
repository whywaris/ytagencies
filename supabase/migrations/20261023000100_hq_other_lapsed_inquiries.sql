-- Add-agency locations and read-only inquiries for lapsed owners. schema.sql has the same result.
--
-- 1. A submission sets its HQ (a country, or a city from our list) and may name a city we don't
--    list yet ("Other"): hq_other holds that text until an admin maps it to a location.
-- 2. agency_managed(): the managed rule from lib/entitlements.ts in SQL (live Pro: active in its
--    dates, or past due within 7 days). Marking an inquiry as contacted needs it, so a lapsed
--    owner can still read past inquiries (the existing read policy) but no longer change them.

begin;

-- 1. HQ on submission
alter table agencies add column hq_other text check (char_length(hq_other) between 1 and 100);
grant insert (hq_location_id, hq_other) on agencies to authenticated;

-- 2. Managed, in SQL
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

drop policy "owner marks contacted" on lead_routes;
create policy "owner marks contacted" on lead_routes for update to authenticated
  using (agency_managed(agency_id)
    and exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()))
  with check (agency_managed(agency_id)
    and exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));

commit;
