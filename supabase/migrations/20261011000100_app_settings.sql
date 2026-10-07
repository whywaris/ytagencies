-- ADMIN_V2_SPEC §5.10: admin settings for the Founding programme (open/closed, max spots, free
-- months). One row. schema.sql has the same table for fresh projects.

begin;

create table app_settings (
  id boolean primary key default true check (id),
  founding_open boolean not null default true,
  founding_max_spots int not null default 50 check (founding_max_spots between 1 and 1000),
  founding_free_months int not null default 6 check (founding_free_months between 1 and 36),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on app_settings for each row execute function set_updated_at();
insert into app_settings default values;

alter table app_settings enable row level security;
-- Public pages read it server-side with the service role (§7); anon gets nothing.
revoke all on app_settings from anon;
create policy "admin read" on app_settings for select to authenticated using (is_admin());
-- Update only: the single row can't be deleted or duplicated.
create policy "admin update" on app_settings for update to authenticated using (is_admin()) with check (is_admin());

commit;
