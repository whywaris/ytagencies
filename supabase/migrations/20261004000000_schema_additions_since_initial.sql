-- Everything added to supabase/schema.sql after the initial schema (rate limiting, auth profile
-- trigger, owner update fix, one-open-claim index, storage bucket and policies).
-- Apply once to a project that only has the initial schema. A fresh project just runs schema.sql.


-- ───────── Rate limiting for public forms (SECURITY.md: 5/hour per IP and per email) ─────────
-- Keys are hashed server-side (e.g. 'ip:<sha256>', 'email:<sha256>'); no raw IPs or emails stored.
create table rate_limits (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_limits_key_created_idx on rate_limits (key, created_at);
create index rate_limits_created_idx on rate_limits (created_at);
alter table rate_limits enable row level security; -- no policies: service role only

-- Records a hit and returns true if the key is still under p_limit within p_window.
-- The advisory lock makes check + insert atomic per key.
create or replace function hit_rate_limit(p_key text, p_limit int, p_window interval)
returns boolean language plpgsql set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  -- Prune every expired row, not just this key's, so hashes don't outlive the window (privacy policy).
  delete from rate_limits where created_at < now() - p_window;
  select count(*) into n from rate_limits where key = p_key;
  if n >= p_limit then return false; end if;
  insert into rate_limits (key) values (p_key);
  return true;
end $$;
revoke all on function hit_rate_limit(text, int, interval) from public, anon, authenticated;

-- ───────── Auth: one profile row per user ─────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────── Owners may edit content columns only ─────────
-- The original "owner update" check (is_featured = false and is_verified = false) validated the new row,
-- so owners of verified or featured agencies could never save. Column privileges protect the
-- admin-only fields (status, flags, owner_id, slug, website) instead. Admin writes use the service role.
drop policy "owner update" on agencies;
create policy "owner update" on agencies for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke update on agencies from anon, authenticated;
grant update (tagline, description, logo_path, min_budget_usd, pricing_model, team_size,
  founded_year, languages, hq_location_id, updated_at) on agencies to authenticated;

-- One open claim per user per agency.
create unique index claims_one_pending on claims (agency_id, user_id) where status = 'pending';

-- ───────── Storage: agency logos (SECURITY.md) ─────────
-- Public read for logos; owners write only to agencies/<their agency id>/. png/jpg/webp, max 2 MB.
-- The server action also checks file signatures, since the declared type can't be trusted.
-- objects.name must be qualified: inside the subquery a bare `name` would resolve to agencies.name.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agency-media', 'agency-media', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage's remove() and upsert filter rows as the user, so they also need a SELECT policy.
-- Without it, deleting an old logo silently matches nothing.
create policy "owners read own agency folder" on storage.objects for select to authenticated
  using (bucket_id = 'agency-media' and (storage.foldername(objects.name))[1] = 'agencies' and exists (
    select 1 from public.agencies a where a.id::text = (storage.foldername(objects.name))[2] and a.owner_id = auth.uid()));
create policy "owners write own agency folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'agency-media' and (storage.foldername(name))[1] = 'agencies' and exists (
    select 1 from public.agencies a where a.id::text = (storage.foldername(objects.name))[2] and a.owner_id = auth.uid()));
create policy "owners update own agency folder" on storage.objects for update to authenticated
  using (bucket_id = 'agency-media' and (storage.foldername(name))[1] = 'agencies' and exists (
    select 1 from public.agencies a where a.id::text = (storage.foldername(objects.name))[2] and a.owner_id = auth.uid()));
create policy "owners delete own agency folder" on storage.objects for delete to authenticated
  using (bucket_id = 'agency-media' and (storage.foldername(name))[1] = 'agencies' and exists (
    select 1 from public.agencies a where a.id::text = (storage.foldername(objects.name))[2] and a.owner_id = auth.uid()));
