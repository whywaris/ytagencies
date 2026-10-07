-- Guide authors, key takeaways, numbered sections and an in_review status (guide redesign).
-- schema.sql has the same tables for fresh projects; the default author is also in seed.sql.

begin;

create table authors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(name) between 1 and 100),
  role text check (char_length(role) <= 100),
  bio text check (char_length(bio) <= 300),
  avatar_path text,
  linkedin_url text check (linkedin_url ~ '^https://' and char_length(linkedin_url) <= 300),
  x_url text check (x_url ~ '^https://' and char_length(x_url) <= 300),
  website_url text check (website_url ~ '^https://' and char_length(website_url) <= 300),
  -- For future contributor accounts. Never exposed to the public (see the column grants below).
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on authors for each row execute function set_updated_at();

-- Every existing guide moves to one default author; rename it in Admin → Authors.
insert into authors (slug, name, role) values ('editorial-team', 'Editorial team', 'YT Agencies');

alter table guides add column author_id uuid references authors(id) on delete set null;
update guides set author_id = (select id from authors where slug = 'editorial-team');
alter table guides drop column author_name;
create index guides_author_idx on guides (author_id);

-- in_review: for future contributor submissions (no UI yet). Like drafts, it has no date and is
-- never public.
alter table guides drop constraint guides_status_check;
alter table guides add constraint guides_status_check
  check (status in ('draft', 'in_review', 'scheduled', 'published'));
alter table guides drop constraint guides_check;
alter table guides add constraint guides_check
  check (status in ('draft', 'in_review') or published_at is not null);

alter table guides
  add column key_takeaways text[] not null default '{}'
    check (cardinality(key_takeaways) <= 5 and char_length(array_to_string(key_takeaways, '')) <= 1000),
  add column numbered_sections boolean not null default false;

alter table authors enable row level security;
-- Column grants: the public (anon key) and signed-in users can't read user_id at all.
revoke all on authors from anon, authenticated;
grant select (id, slug, name, role, bio, avatar_path, linkedin_url, x_url, website_url, created_at,
  updated_at) on authors to anon, authenticated;
grant insert, update, delete on authors to authenticated;
-- Public: only authors with at least one live guide (published, or scheduled with its time passed).
create policy "read authors of live guides" on authors for select using (
  exists (select 1 from guides g where g.author_id = authors.id
          and g.status in ('published', 'scheduled') and g.published_at <= now())
  or is_admin());
create policy "admin write" on authors for all to authenticated using (is_admin()) with check (is_admin());

commit;
