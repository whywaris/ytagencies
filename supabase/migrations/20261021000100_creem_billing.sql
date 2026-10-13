-- Creem billing for Pro. schema.sql has the same result for fresh projects.
--
-- 1. agency_subscriptions gets what Creem reports: the billing interval, the Creem customer (for
--    the customer portal), when the last applied event happened (older, out-of-order deliveries
--    are ignored) and when the "Pro ends in 3 days" email went out. A Creem subscription id
--    (external_id) maps to exactly one row.
-- 2. billing_events: every Creem webhook event, by its Creem id, so retries are skipped once
--    processed. Admin read only; the webhook writes with the service role.

begin;

-- 1. Subscriptions
alter table agency_subscriptions
  add column billing_interval text check (billing_interval in ('month', 'year')),
  add column customer_id text check (char_length(customer_id) <= 200),
  add column last_event_at timestamptz,
  add column ending_notice_sent_at timestamptz;
create unique index agency_subscriptions_external_id on agency_subscriptions (external_id)
  where source = 'payment';

-- 2. Webhook events
create table billing_events (
  id text primary key check (char_length(id) between 1 and 200),
  type text not null check (char_length(type) between 1 and 100),
  agency_id uuid references agencies(id) on delete set null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index billing_events_agency_idx on billing_events (agency_id, received_at desc);

alter table billing_events enable row level security;
revoke all on billing_events from anon, authenticated;
grant select on billing_events to authenticated;
create policy "admin read" on billing_events for select to authenticated using (is_admin());

commit;
