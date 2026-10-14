-- Get matched in two steps: the project (goal, budget, start) and the business's details.
-- RLS unchanged: anon can't read leads; admins and the agencies a lead is routed to can.

alter table leads
  add column goal text check (goal in ('leads-sales', 'views-subs', 'brand', 'not-sure')),
  add column start_timeline text check (start_timeline in ('asap', 'this-month', 'exploring')),
  add column business_url text check (char_length(business_url) <= 300),
  add column channel_url text check (char_length(channel_url) <= 300),
  add column customer_location text check (char_length(customer_location) <= 120),
  add column prior_agency text check (prior_agency in ('first', 'went-well', 'didnt-work')),
  -- New ranges ($1k–3k, $3k–5k); '1k-5k' stays valid for leads sent before.
  add constraint leads_budget_range_check check (
    budget_range in ('under-1k', '1k-3k', '3k-5k', '5k-10k', '10k-plus', 'not-sure', '1k-5k')
  );
