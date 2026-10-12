-- Pricing details and response time. schema.sql has the same objects for fresh projects.
--
-- 1. agencies.min_contract, ad_spend, setup_fee_usd: required in the forms (setup fee optional),
--    null for agencies that haven't filled them in yet. Readable by anon (column grant), writable
--    by owners and submitters through their column grants.
-- 2. lead_routes.contacted_at: the owner marks a routed lead as contacted. The time is always the
--    server's (a trigger), set once, so it can't be backdated to fake a fast reply.
--    lead_routes.reminded_at: the one "a business is waiting" email was sent (daily cron).
-- 3. agency_response_times: median time to contact per published agency over the last 90 days,
--    only with 3+ contacted leads and a median under 48 hours (slower or thinner data shows
--    nothing). An aggregate the public pages can read; lead_routes itself stays private.

begin;

alter table agencies
  add column min_contract text
    check (min_contract in ('none', '1_month', '3_months', '6_months', '12_months')),
  add column ad_spend text check (ad_spend in ('separate', 'included', 'not_applicable')),
  add column setup_fee_usd int check (setup_fee_usd between 0 and 9999999);

grant select (min_contract, ad_spend, setup_fee_usd) on agencies to anon;
grant update (min_contract, ad_spend, setup_fee_usd) on agencies to authenticated;
grant insert (min_contract, ad_spend, setup_fee_usd) on agencies to authenticated;

alter table lead_routes add column contacted_at timestamptz, add column reminded_at timestamptz;

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

commit;
