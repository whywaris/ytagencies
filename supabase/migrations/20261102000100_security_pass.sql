-- Security pass (Supabase security advisor).
--  1. agency_response_times was a SECURITY DEFINER view (advisor ERROR). It becomes a SECURITY
--     DEFINER function that returns only (agency_id, median_minutes, contacted), with search_path
--     set; anon and authenticated may call it (the profile page and directory read it as anon).
--     The view is dropped: nothing else read it.
--  2. admin_agency_list (service role only) becomes security_invoker; the service role bypasses
--     RLS, so the admin pages read the same rows.
--  3. search_path on set_updated_at() and text_items_within().
--  4. Trigger functions can't be called directly; EXECUTE is revoked anyway so the advisor and
--     a future CREATE TRIGGER by a non-owner both stay closed. text_items_within keeps EXECUTE
--     (check constraints run it as the writing role). is_admin keeps EXECUTE for anon and
--     authenticated: policies on the public role call it (reviews, guides, agencies, profiles).
--     agency_managed and lead_previews stay authenticated-only (their policies and the dashboard).
--  5. rate_limits and page_view_events: RLS on with no policies on purpose: service role only.
-- schema.sql has the same objects.

begin;

drop view if exists agency_response_times;
create or replace function agency_response_times()
returns table (agency_id uuid, median_minutes int, contacted int)
language sql stable security definer set search_path = public as $$
  -- Published agencies with 3+ contacted requests in 90 days and a median under 2 days. Only this
  -- aggregate leaves the function: never a route, a lead or a timestamp.
  select r.agency_id,
    round(percentile_cont(0.5) within group (
      order by extract(epoch from (r.contacted_at - r.sent_at)) / 60))::int,
    count(*)::int
  from lead_routes r
  join agencies a on a.id = r.agency_id
  where a.status = 'published'
    and r.contacted_at is not null
    and r.sent_at >= now() - interval '90 days'
  group by r.agency_id
  having count(*) >= 3
    and percentile_cont(0.5) within group (
      order by extract(epoch from (r.contacted_at - r.sent_at))) < 48 * 3600
$$;
revoke execute on function agency_response_times() from public;
grant execute on function agency_response_times() to anon, authenticated, service_role;

alter view admin_agency_list set (security_invoker = on);

alter function set_updated_at() set search_path = public;
alter function text_items_within(text[], int) set search_path = public;

revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function record_inquiry_event() from public, anon, authenticated;
revoke execute on function sync_agency_verified() from public, anon, authenticated;
revoke execute on function touch_agency() from public, anon, authenticated;
revoke execute on function set_updated_at() from public, anon, authenticated;
revoke execute on function lead_route_contacted() from public, anon, authenticated;
revoke execute on function agency_channels_limit() from public, anon, authenticated;
revoke execute on function agency_channels_url_changed() from public, anon, authenticated;
revoke execute on function work_samples_limit() from public, anon, authenticated;

-- agency_managed and lead_previews: authenticated only (re-stated; anon never had them).
revoke execute on function agency_managed(uuid) from public, anon;
revoke execute on function lead_previews(uuid) from public, anon;

comment on table rate_limits is
  'Hashed form submission keys (lib/forms/guard.ts). RLS on, no policies: service role only (hit_rate_limit, rateLimitRetryAt).';
comment on table page_view_events is
  'One row per visitor per directory page for 90 days (record_page_view). RLS on, no policies: service role only.';
revoke all on rate_limits from anon, authenticated;

commit;
