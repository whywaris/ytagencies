-- Pro-only management, Founding removed. schema.sql has the same result for fresh projects.
--
-- Listings are free and can exist without an owner; managing one needs an active Pro
-- subscription ($29/month or $279/year). There's no Founding plan and no free managed plan.
--
-- 1. Founding subscriptions become Pro, source 'manual', same dates (nobody loses access
--    silently). Then the 'founding' and 'free' plans and the 'founding' source go.
-- 2. Subscriptions can be 'past_due' (with past_due_since, 7-day grace in the app) or cancel at
--    the end of the period (cancel_at_period_end): what the payment provider will report.
-- 3. app_settings loses the Founding programme fields.
-- 4. contact_messages gets the 'pro' topic (Request Pro while payments are off).
-- 5. leads.ref: where a Get matched request started (e.g. "profile:<slug>").

begin;

-- 1. Founding → Pro
update agency_subscriptions set plan_id = 'pro', source = 'manual' where plan_id = 'founding';
-- "Free" was never a stored subscription; drop any stray rows so the plan can go.
delete from agency_subscriptions where plan_id = 'free';

alter table agency_subscriptions drop constraint agency_subscriptions_source_check;
alter table agency_subscriptions
  add constraint agency_subscriptions_source_check check (source in ('manual', 'payment'));

update plans set name = 'Pro', price_monthly = 29, price_yearly = 279 where id = 'pro';
delete from plans where id in ('free', 'founding');
alter table plans drop constraint plans_id_check;
alter table plans add constraint plans_id_check check (id in ('pro'));

-- 2. Billing states
alter table agency_subscriptions drop constraint agency_subscriptions_status_check;
alter table agency_subscriptions
  add constraint agency_subscriptions_status_check
    check (status in ('active', 'past_due', 'expired', 'cancelled'));
alter table agency_subscriptions
  add column cancel_at_period_end boolean not null default false,
  add column past_due_since timestamptz,
  add constraint agency_subscriptions_past_due check (status <> 'past_due' or past_due_since is not null);
-- One live subscription per agency: active or past due.
drop index agency_subscriptions_one_active;
create unique index agency_subscriptions_one_active on agency_subscriptions (agency_id)
  where status in ('active', 'past_due');

-- 3. Founding programme settings
alter table app_settings
  drop column founding_open,
  drop column founding_max_spots,
  drop column founding_free_months;

-- 4. Request Pro → admin Inbox
alter table contact_messages drop constraint contact_messages_topic_check;
alter table contact_messages
  add constraint contact_messages_topic_check
    check (topic in ('general', 'agencies', 'report', 'press', 'privacy', 'pro'));

-- 5. Lead origin
alter table leads add column ref text check (ref ~ '^[a-z]+(:[a-z0-9-]{1,80})?$');

commit;
