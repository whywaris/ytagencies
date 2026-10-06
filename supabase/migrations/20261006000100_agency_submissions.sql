-- Agency submissions from /list-your-agency. schema.sql has the same end state for fresh projects.

begin;

-- ───────── Agency submissions (/list-your-agency) ─────────
-- A signed-in user can submit an agency that isn't listed. It's a draft with no owner: owner_id is
-- only set once the work email is confirmed on the website's domain (claims flow) or an admin
-- approves the submission. submitted_by is not in anon's column grant, like owner_id.
alter table agencies add column if not exists submitted_by uuid references auth.users(id) on delete set null;
create index if not exists agencies_submitted_by_idx on agencies (submitted_by) where submitted_by is not null;

-- Users may provide content columns only. status, owner_id, is_claimed, is_verified and is_featured
-- keep their defaults (draft, null, false), so a user can't publish, own, verify or feature on insert.
-- Admin inserts use the service role.
revoke insert on agencies from anon, authenticated;
grant insert (id, slug, name, website, description, min_budget_usd, submitted_by) on agencies to authenticated;

-- Belt and braces on top of the grants, plus a cap of 3 open submissions per account.
create policy "submit draft" on agencies for insert to authenticated with check (
  submitted_by = auth.uid() and status = 'draft' and owner_id is null
  and not is_claimed and not is_verified and not is_featured
  and (select count(*) from agencies a where a.submitted_by = auth.uid() and a.status = 'draft') < 3);

-- Submitters can see their own submission (needed for the checks below and their dashboard).
alter policy "read published or own" on agencies
  using (status = 'published' or owner_id = auth.uid() or submitted_by = auth.uid() or is_admin());

-- Submitters can attach services, industries and locations to their own unowned draft, nothing else.
create policy "submitter adds to own draft" on agency_services for insert to authenticated with check (
  exists (select 1 from agencies a where a.id = agency_id and a.submitted_by = auth.uid() and a.status = 'draft' and a.owner_id is null));
create policy "submitter adds to own draft" on agency_industries for insert to authenticated with check (
  exists (select 1 from agencies a where a.id = agency_id and a.submitted_by = auth.uid() and a.status = 'draft' and a.owner_id is null));
create policy "submitter adds to own draft" on agency_locations for insert to authenticated with check (
  exists (select 1 from agencies a where a.id = agency_id and a.submitted_by = auth.uid() and a.status = 'draft' and a.owner_id is null));

commit;
