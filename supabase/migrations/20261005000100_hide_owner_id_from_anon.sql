-- Stop exposing agencies.owner_id to anon (the public anon key).
-- Postgres checks column privileges inside policy expressions too, so every policy anon evaluates
-- must avoid owner_id: owner/admin policies move to `authenticated`, anon gets status-only ones.
-- schema.sql has the same end state for fresh projects.

begin;

-- Agencies
drop policy "public read published" on agencies;
create policy "anon read published" on agencies for select to anon
  using (status = 'published');
create policy "read published or own" on agencies for select to authenticated
  using (status = 'published' or owner_id = auth.uid() or is_admin());
alter policy "owner update" on agencies to authenticated;
alter policy "admin all" on agencies to authenticated;

-- Join tables and case studies
alter policy "public read" on agency_services to authenticated;
alter policy "owner manage" on agency_services to authenticated;
create policy "anon read published" on agency_services for select to anon using (
  exists (select 1 from agencies a where a.id = agency_id and a.status = 'published'));

alter policy "public read" on agency_industries to authenticated;
alter policy "owner manage" on agency_industries to authenticated;
create policy "anon read published" on agency_industries for select to anon using (
  exists (select 1 from agencies a where a.id = agency_id and a.status = 'published'));

alter policy "public read" on agency_locations to authenticated;
alter policy "owner manage" on agency_locations to authenticated;
create policy "anon read published" on agency_locations for select to anon using (
  exists (select 1 from agencies a where a.id = agency_id and a.status = 'published'));

alter policy "public read" on case_studies to authenticated;
alter policy "owner manage" on case_studies to authenticated;
create policy "anon read published" on case_studies for select to anon using (
  exists (select 1 from agencies a where a.id = agency_id and a.status = 'published'));

-- Leads (never anon anyway; their policies join agencies.owner_id)
alter policy "admin read" on leads to authenticated;
alter policy "agency reads routed leads" on leads to authenticated;
alter policy "agency reads own routes" on lead_routes to authenticated;

-- Column privileges: every agencies column except owner_id. New columns must be added here.
revoke select on agencies from anon;
grant select (id, slug, name, tagline, description, website, logo_path, founded_year, team_size,
  min_budget_usd, pricing_model, languages, hq_location_id, status, is_claimed, is_verified,
  is_featured, search, created_at, updated_at) on agencies to anon;

commit;
