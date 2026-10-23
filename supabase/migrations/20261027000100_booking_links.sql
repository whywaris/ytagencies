-- Pro booking buttons: a Calendly link and a WhatsApp number on the profile (shown only while the
-- agency is on Pro; the app checks that). Clicks are counted as agency events like website
-- clicks. schema.sql has the same objects.

begin;

alter table agencies
  add column calendly_url text
    check (calendly_url ~ '^https://(www\.)?calendly\.com/[A-Za-z0-9/_-]+$' and char_length(calendly_url) <= 300),
  -- Digits only, country code first (wa.me/<number>).
  add column whatsapp_number text check (whatsapp_number ~ '^[1-9][0-9]{7,14}$');

-- anon reads every agencies column except owner_id (CLAUDE.md); owners edit their own.
grant select (calendly_url, whatsapp_number) on agencies to anon;
grant update (calendly_url, whatsapp_number) on agencies to authenticated;

alter table agency_events drop constraint agency_events_type_check;
alter table agency_events add constraint agency_events_type_check check (
  type in ('profile_view', 'website_click', 'contact_open', 'inquiry', 'calendly_click', 'whatsapp_click')
);
alter table agency_event_daily drop constraint agency_event_daily_type_check;
alter table agency_event_daily add constraint agency_event_daily_type_check check (
  type in ('profile_view', 'website_click', 'contact_open', 'inquiry', 'calendly_click', 'whatsapp_click')
);

commit;
