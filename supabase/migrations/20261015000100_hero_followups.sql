-- Home hero follow-ups. schema.sql has the same changes for fresh projects.
-- 1. case_studies.channel_id: the case study's channel link resolved to a YouTube channel ID when
--    it's saved (server-side, YouTube Data API), so the home hero matches channels on the stored ID
--    and never calls YouTube while pages build. /channel/UC… links are filled in here; @handle and
--    /c/ links are resolved the next time the case study or the agency's verification is saved.
-- 2. Agency submissions now ask for the pricing unit with the starting price.

begin;

alter table case_studies
  add column channel_id text check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$');

update case_studies
set channel_id = substring(channel_url from '/channel/(UC[A-Za-z0-9_-]{22})')
where channel_url ~ '/channel/UC[A-Za-z0-9_-]{22}';

grant insert (pricing_model) on agencies to authenticated;

commit;
