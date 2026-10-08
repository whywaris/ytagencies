-- Permanent agency delete from the admin. Everything about an agency cascades with it (links,
-- case studies, reviews, verifications, subscriptions, sponsored slots, claims, events and
-- rollups, lead routes), except the leads themselves: before an agency goes, the routes of the
-- leads it received are copied here with its name, so Admin → Leads still shows
-- "sent to <name> (deleted)". schema.sql has the same objects for fresh projects.

begin;

create table deleted_agency_routes (
  lead_id uuid not null references leads(id) on delete cascade,
  -- The deleted agency's id; no foreign key, because the agency is gone.
  agency_id uuid not null,
  agency_name text not null,
  agency_slug text not null,
  sent_at timestamptz not null,
  deleted_at timestamptz not null default now(),
  primary key (lead_id, agency_id)
);

alter table deleted_agency_routes enable row level security;
revoke all on deleted_agency_routes from anon;
create policy "admin read" on deleted_agency_routes for select to authenticated using (is_admin());

-- One transaction: copy the route history, then delete (cascades do the rest). Returns what was
-- deleted. Only the service role may run it; the server action checks the admin first.
create or replace function delete_agencies(p_ids uuid[])
returns table (id uuid, name text, slug text)
language plpgsql set search_path = public as $$
begin
  insert into deleted_agency_routes (lead_id, agency_id, agency_name, agency_slug, sent_at)
  select r.lead_id, a.id, a.name, a.slug, r.sent_at
  from lead_routes r join agencies a on a.id = r.agency_id
  where a.id = any(p_ids)
  on conflict do nothing;
  return query delete from agencies a where a.id = any(p_ids) returning a.id, a.name, a.slug;
end $$;
revoke all on function delete_agencies(uuid[]) from public, anon, authenticated;
grant execute on function delete_agencies(uuid[]) to service_role;

commit;
