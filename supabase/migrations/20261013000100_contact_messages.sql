-- /contact messages (company pages). Written only by the contact form's server action (service
-- role, after Turnstile, honeypot and rate limit); read and handled in Admin → Inbox.
-- schema.sql has the same table for fresh projects.

begin;

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic in ('general', 'agencies', 'report', 'press', 'privacy')),
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

commit;
