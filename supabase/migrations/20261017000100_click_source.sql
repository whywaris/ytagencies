-- Referral attribution: website clicks remember where the link was (its utm_content: profile,
-- directory, home_hero, guide), so the agency dashboard can break "Visitors sent to your website"
-- down by source. Other event types keep source ''. Clicks recorded before this all came from
-- the profile (the only place with a website link). schema.sql has the same objects.

begin;

alter table agency_events
  add column source text not null default ''
  check (source in ('', 'profile', 'directory', 'home_hero', 'guide'));
alter table agency_event_daily
  add column source text not null default ''
  check (source in ('', 'profile', 'directory', 'home_hero', 'guide'));

update agency_events set source = 'profile' where type = 'website_click';
update agency_event_daily set source = 'profile' where type = 'website_click';

alter table agency_event_daily drop constraint agency_event_daily_pkey;
alter table agency_event_daily add primary key (agency_id, day, type, source);

drop function record_agency_event(uuid, text, text, text);
create function record_agency_event(
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

commit;
