-- ADMIN_V2_SPEC §6: paid placement now comes from plans (Founding/Verified rank above Free) and
-- sponsored slots, so the old "Featured · Paid" flag goes. Recreates what referenced the column.
-- schema.sql has the same end state for fresh projects.
--
-- Dev data: agencies that were featured are NOT converted to a plan here; grant Founding by hand in
-- Admin → Plans if they should keep paid placement.

begin;

drop view admin_agency_list;
drop policy "submit draft" on agencies;

alter table agencies drop column is_featured; -- also drops it from anon's column grant

create policy "submit draft" on agencies for insert to authenticated with check (
  submitted_by = auth.uid() and status = 'draft' and owner_id is null
  and not is_claimed and not is_verified
  and (select count(*) from agencies a where a.submitted_by = auth.uid() and a.status = 'draft') < 3);

create view admin_agency_list as
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

commit;
