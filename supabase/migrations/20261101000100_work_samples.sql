-- Work samples: YouTube videos an agency worked on, shown on its profile (lib/work-samples.ts).
--  * The video is checked with YouTube oEmbed on save (public, embeddable); its title and format
--    (long or short) come from there.
--  * service_id: one of the agency's own services (checked by the server action).
--  * hidden_at: an admin hid it (moderation). Plan limits (3 on Free, 12 on Pro) aren't stored:
--    the profile shows the first N by sort_order, so a downgrade hides the rest without deleting.
--  * Owners manage their own rows; anon reads rows of published agencies that aren't hidden.
--    Owners can't write hidden_at.
-- schema.sql has the same objects.

begin;

create table work_samples (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (char_length(title) between 1 and 200),
  format text not null check (format in ('long', 'short')),
  service_id int not null references services(id),
  note text check (char_length(note) <= 140),
  sort_order int not null default 0,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, youtube_video_id)
);
create index work_samples_agency_idx on work_samples (agency_id, sort_order);
create trigger set_updated_at before update on work_samples
  for each row execute function set_updated_at();
create trigger touch_agency after insert or update or delete on work_samples
  for each row execute function touch_agency();

-- A hard ceiling (Pro's 12); the app enforces each plan's own limit.
create or replace function work_samples_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from work_samples where agency_id = new.agency_id) >= 12 then
    raise exception 'An agency can add up to 12 work samples' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger work_samples_limit before insert on work_samples
  for each row execute function work_samples_limit();

alter table work_samples enable row level security;
create policy "public read published" on work_samples for select using (
  hidden_at is null
  and exists (select 1 from agencies a where a.id = agency_id and a.status = 'published'));
create policy "owner read" on work_samples for select to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()) or is_admin());
create policy "owner insert" on work_samples for insert to authenticated with check (
  exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));
create policy "owner update" on work_samples for update to authenticated
  using (exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));
create policy "owner delete" on work_samples for delete to authenticated using (
  exists (select 1 from agencies a where a.id = agency_id and a.owner_id = auth.uid()));
-- Admins hide and unhide with the service role (lib/actions/admin-directory.ts).

revoke all on work_samples from anon, authenticated;
-- anon: what the profile shows (no hidden_at: those rows aren't readable anyway).
grant select (id, agency_id, youtube_video_id, title, format, service_id, note, sort_order,
  created_at, updated_at) on work_samples to anon;
grant select on work_samples to authenticated;
-- Owners write the video (after the server's oEmbed check), its service, note and order; never
-- hidden_at.
grant insert (agency_id, youtube_video_id, title, format, service_id, note, sort_order)
  on work_samples to authenticated;
grant update (service_id, note, sort_order) on work_samples to authenticated;
grant delete on work_samples to authenticated;

commit;
