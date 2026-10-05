-- updated_at on content tables, kept current by triggers, so sitemap lastmod reflects real edits
-- (docs/SEO.md). Agency child rows (services, industries, locations, case studies, published reviews)
-- also bump agencies.updated_at. schema.sql has the same end state for fresh projects.

begin;

alter table services add column if not exists updated_at timestamptz not null default now();
alter table industries add column if not exists updated_at timestamptz not null default now();
alter table service_industry_content add column if not exists updated_at timestamptz not null default now();
alter table case_studies add column if not exists updated_at timestamptz not null default now();
alter table reviews add column if not exists updated_at timestamptz not null default now();

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger set_updated_at before update on agencies for each row execute function set_updated_at();
create trigger set_updated_at before update on services for each row execute function set_updated_at();
create trigger set_updated_at before update on industries for each row execute function set_updated_at();
create trigger set_updated_at before update on service_industry_content for each row execute function set_updated_at();
create trigger set_updated_at before update on case_studies for each row execute function set_updated_at();
create trigger set_updated_at before update on reviews for each row execute function set_updated_at();

-- A profile shows its services, industries, locations, case studies and published reviews, so changes
-- to those bump the agency's updated_at (its sitemap lastmod and directory page dates).
-- security definer: it only sets updated_at, and must work whichever role made the change.
create or replace function touch_agency() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'reviews' then
    -- Pending or rejected reviews aren't shown, so only count changes that involve a published one.
    if not ((tg_op <> 'DELETE' and new.status = 'published') or (tg_op <> 'INSERT' and old.status = 'published')) then
      return null;
    end if;
  end if;
  update agencies set updated_at = now()
  where id = case when tg_op = 'DELETE' then old.agency_id else new.agency_id end;
  return null;
end $$;

create trigger touch_agency after insert or update or delete on agency_services for each row execute function touch_agency();
create trigger touch_agency after insert or update or delete on agency_industries for each row execute function touch_agency();
create trigger touch_agency after insert or update or delete on agency_locations for each row execute function touch_agency();
create trigger touch_agency after insert or update or delete on case_studies for each row execute function touch_agency();
create trigger touch_agency after insert or update or delete on reviews for each row execute function touch_agency();

commit;
