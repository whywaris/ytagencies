-- Rename the paid plan from 'verified' ("Verified") to 'pro' ("Pro"), so the paid plan can never
-- be confused with the Verified badge. Subscriptions move to the new id with their dates, source
-- and history unchanged. Older admin_actions entries still say plan 'verified' (the admin shows it
-- as Pro). schema.sql has the same result for fresh projects.

begin;

alter table plans drop constraint plans_id_check;

insert into plans (id, name, price_monthly, price_yearly)
select 'pro', 'Pro', price_monthly, price_yearly from plans where id = 'verified'
on conflict (id) do nothing;

update agency_subscriptions set plan_id = 'pro' where plan_id = 'verified';

delete from plans where id = 'verified';

alter table plans add constraint plans_id_check check (id in ('free', 'founding', 'pro'));

commit;
