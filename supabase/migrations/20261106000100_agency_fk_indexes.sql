-- Indexes for the agency_id foreign keys that every directory list and profile embeds
-- (reviews(rating), case_studies(count)). Without them each agency row scans both tables, and
-- prerendering ~1,000 profiles hit Supabase's statement timeout. schema.sql has the same objects.
create index if not exists reviews_agency_idx on reviews (agency_id);
create index if not exists case_studies_agency_idx on case_studies (agency_id);
