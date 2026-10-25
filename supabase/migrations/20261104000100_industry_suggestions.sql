-- Industry suggestions from each agency's own website (scripts/enrich-industries.mjs), reviewed in
-- Admin → Directory → Industry review. Nothing reaches agency_industries without an admin's
-- approval (lib/actions/admin-industry-review.ts).
--  * evidence_text: the exact sentence from source_url (a snippet, never the page's HTML).
--  * unique (agency_id, industry_id): one suggestion per pair, ever. A rejected one is never
--    suggested again; the script inserts with "on conflict do nothing", so re-runs are idempotent.
--  * industry_enrichment_runs: when the script last looked at an agency (with or without a
--    suggestion), so it skips agencies checked in the last 30 days and can resume after a crash.
--  * Admin only: anon and non-admin users have no access. The script writes with the service role.
-- schema.sql has the same objects.

begin;

create table industry_suggestions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  industry_id int not null references industries(id) on delete cascade,
  evidence_text text not null check (char_length(evidence_text) between 1 and 300),
  source_url text not null check (source_url ~ '^https?://' and char_length(source_url) <= 2000),
  method text not null check (method in ('keywords', 'llm')),
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (agency_id, industry_id),
  -- Reviewed exactly when it's no longer pending.
  check ((status = 'pending') = (reviewed_at is null))
);
create index industry_suggestions_queue_idx on industry_suggestions (status, agency_id);
create index industry_suggestions_reviewed_idx on industry_suggestions (reviewed_at) where status = 'approved';

create table industry_enrichment_runs (
  agency_id uuid primary key references agencies(id) on delete cascade,
  checked_at timestamptz not null default now(),
  outcome text not null check (outcome in ('ok', 'no_website', 'blocked', 'failed')),
  pages int not null default 0 check (pages between 0 and 4),
  detail text check (char_length(detail) <= 300)
);

alter table industry_suggestions enable row level security;
alter table industry_enrichment_runs enable row level security;

revoke all on industry_suggestions, industry_enrichment_runs from anon, authenticated;
grant select on industry_suggestions, industry_enrichment_runs to authenticated;
grant update (status, reviewed_by, reviewed_at) on industry_suggestions to authenticated;

create policy "admin reads suggestions" on industry_suggestions
  for select to authenticated using (is_admin());
create policy "admin reviews suggestions" on industry_suggestions
  for update to authenticated using (is_admin()) with check (is_admin() and reviewed_by = auth.uid());
create policy "admin reads enrichment runs" on industry_enrichment_runs
  for select to authenticated using (is_admin());

commit;
