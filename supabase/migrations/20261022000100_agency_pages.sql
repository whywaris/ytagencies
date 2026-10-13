-- Agency-facing pages. schema.sql has the same result for fresh projects.
--
-- 1. Directory page views ("Where businesses are looking" on the agency dashboard, the live
--    numbers on /list-your-agency): the same beacon, bot filter and daily visitor hash as profile
--    views, one row per page path per visitor per day, rolled up per day. Raw rows go after 90 days.
-- 2. Claims without a matching work email carry proof for the admin: role, LinkedIn, a note.
-- 3. contact_messages gets the 'access' topic: asking for access to a listing someone else manages.

begin;

-- 1. Directory page views
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

-- 2. Claim proof
alter table claims
  add column role text check (char_length(role) <= 100),
  add column linkedin_url text check (char_length(linkedin_url) <= 300),
  add column note text check (char_length(note) <= 1000);

-- 3. Access requests → admin Inbox
alter table contact_messages drop constraint contact_messages_topic_check;
alter table contact_messages
  add constraint contact_messages_topic_check
    check (topic in ('general', 'agencies', 'report', 'press', 'privacy', 'pro', 'access'));

commit;
