-- Outreach emails: invite unclaimed agencies to claim their free profile (Admin → Growth →
-- Outreach). Low volume, honest copy, sent by the outreach cron (lib/outreach-mail.ts).
--  * agency_outreach_contacts stays the one address per agency (and its opt-out).
--  * outreach_messages: at most one invite and one reminder per agency, ever (unique). token is
--    random and only tracks clicks on the claim link; it is never proof of ownership.
--  * outreach_suppressions: addresses that bounced or complained. Never emailed again, by any
--    agency's contact row.
--  * app_settings: sender, addresses, daily cap, reminder delay, pause switch and the two
--    templates. Starts paused, and the cron refuses to send without a From address and a postal
--    address.
--  * When an agency becomes claimed, its queued messages are cancelled and every message gets
--    claimed_at (trigger), whichever way the claim happened.
--  * contact_messages: a "removal" topic and an optional agency_id for "Remove my listing".
--  * Admin only: anon and other users get nothing. The cron and webhooks use the service role.
-- schema.sql has the same objects.

begin;

create table outreach_messages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  email text not null check (char_length(email) <= 254),
  template text not null check (template in ('invite', 'reminder')),
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'cancelled')),
  batch_id uuid,
  resend_id text unique,
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  clicked_at timestamptz,
  claimed_at timestamptz,
  error text check (char_length(error) <= 300),
  unique (agency_id, template)
);
create index outreach_messages_queue_idx on outreach_messages (queued_at) where status = 'queued';
create index outreach_messages_sent_idx on outreach_messages (sent_at);

create table outreach_suppressions (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  reason text not null check (reason in ('bounced', 'complained')),
  created_at timestamptz not null default now()
);

alter table app_settings
  add column outreach_sender_name text not null default 'Waris from YT Agencies'
    check (char_length(outreach_sender_name) <= 80),
  add column outreach_from text not null default ''
    check (outreach_from = '' or outreach_from ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add column outreach_reply_to text not null default ''
    check (outreach_reply_to = '' or outreach_reply_to ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add column outreach_business_address text not null default ''
    check (char_length(outreach_business_address) <= 300),
  add column outreach_daily_cap int not null default 25 check (outreach_daily_cap between 1 and 200),
  add column outreach_reminder_days int not null default 7 check (outreach_reminder_days between 3 and 60),
  add column outreach_paused boolean not null default true,
  add column outreach_invite_subject text not null default '{agency_name} is listed on YT Agencies'
    check (char_length(outreach_invite_subject) between 1 and 150),
  add column outreach_invite_body text not null default $body$Hi,

{agency_name} has a free profile on YT Agencies, a directory where businesses and creators compare YouTube agencies by service and niche:
{profile_url}

It was built from public information, so some details may be missing. You can claim it for free to add your logo, prices, services and the industries you work with:
{claim_url}

If you'd rather not be listed, reply or use the link below and we'll remove it.

{sender_name}
YT Agencies · {business_address}
Unsubscribe: {unsubscribe_url}$body$
    check (char_length(outreach_invite_body) between 1 and 5000),
  add column outreach_reminder_subject text not null default 'Your YT Agencies profile is still unclaimed'
    check (char_length(outreach_reminder_subject) between 1 and 150),
  add column outreach_reminder_body text not null default $body$Hi,

A quick follow-up: the free profile for {agency_name} on YT Agencies is still unclaimed. Claiming it lets you correct the details and add your logo, prices and services:
{claim_url}

This is the last email about it.

{sender_name}
YT Agencies · {business_address}
Unsubscribe: {unsubscribe_url}$body$
    check (char_length(outreach_reminder_body) between 1 and 5000);

-- Claimed (any route): stop what's queued, and credit the outreach that led there.
create or replace function outreach_on_claim() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.is_claimed and not old.is_claimed then
    update outreach_messages set status = 'cancelled' where agency_id = new.id and status = 'queued';
    update outreach_messages set claimed_at = now() where agency_id = new.id and claimed_at is null;
  end if;
  return new;
end;
$$;
revoke execute on function outreach_on_claim() from public, anon, authenticated;
create trigger outreach_on_claim after update of is_claimed on agencies
  for each row execute function outreach_on_claim();

-- "Remove my listing" from the outreach email lands in Admin → Inbox with the agency attached.
alter table contact_messages drop constraint contact_messages_topic_check;
alter table contact_messages add constraint contact_messages_topic_check
  check (topic in ('general', 'agencies', 'report', 'press', 'privacy', 'pro', 'access', 'removal'));
alter table contact_messages add column agency_id uuid references agencies(id) on delete set null;

alter table outreach_messages enable row level security;
alter table outreach_suppressions enable row level security;
revoke all on outreach_messages, outreach_suppressions from anon, authenticated;
grant select on outreach_messages, outreach_suppressions to authenticated;
create policy "admin read" on outreach_messages for select to authenticated using (is_admin());
create policy "admin read" on outreach_suppressions for select to authenticated using (is_admin());

commit;
