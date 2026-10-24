-- Guide categories (admin-managed), the featured guide, and the /guides tab limit.
--  * guide_categories: name, slug, short description (category page), a colour from a fixed
--    palette (AA with white text), order, and whether it's a tab on /guides. Public read, admin
--    write. A category can't be deleted while guides use it (on delete restrict).
--  * guide_category_redirects: old category slugs → the category, for permanent redirects after
--    a slug change.
--  * guides.category_id (one category per guide; required to publish, checked in the app) and
--    guides.is_featured (at most one guide: a partial unique index).
--  * app_settings.guide_tabs_max: how many category tabs /guides shows (default 6).
-- schema.sql has the same objects.

begin;

create table guide_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  description text check (char_length(description) <= 300),
  color text not null default 'blue'
    check (color in ('blue', 'violet', 'mint', 'coral', 'amber', 'pink', 'slate', 'teal')),
  sort_order int not null default 0,
  show_in_tabs boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on guide_categories
  for each row execute function set_updated_at();

create table guide_category_redirects (
  from_slug text primary key check (from_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id uuid not null references guide_categories(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table guide_categories enable row level security;
alter table guide_category_redirects enable row level security;
create policy "public read" on guide_categories for select using (true);
create policy "admin write" on guide_categories for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "public read" on guide_category_redirects for select using (true);
create policy "admin write" on guide_category_redirects for all to authenticated
  using (is_admin()) with check (is_admin());
grant select on guide_categories, guide_category_redirects to anon, authenticated;
grant insert, update, delete on guide_categories, guide_category_redirects to authenticated;

alter table guides
  add column category_id uuid references guide_categories(id) on delete restrict,
  add column is_featured boolean not null default false;
create index guides_category_idx on guides (category_id);
create unique index guides_one_featured on guides (is_featured) where is_featured;
grant select (category_id, is_featured) on guides to anon, authenticated;

alter table app_settings
  add column guide_tabs_max int not null default 6 check (guide_tabs_max between 1 and 12);

commit;
