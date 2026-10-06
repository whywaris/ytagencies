-- ADMIN_V2_SPEC §5.2: one row per agency with what the admin agencies table filters and sorts on
-- (current plan, leads routed in the last 30 days, services, industries), so filtering, sorting
-- and pagination happen in the database. schema.sql has the same end state for fresh projects.
--
-- The view runs with its owner's rights (it reads subscriptions and lead routes across agencies),
-- so it's closed to anon and authenticated: only the service role, after an admin check, reads it.

begin;

create or replace view admin_agency_list as
select
  a.id, a.name, a.slug, a.website, a.logo_path, a.status, a.is_claimed, a.is_verified,
  a.is_featured, a.created_at, a.updated_at,
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

commit;
