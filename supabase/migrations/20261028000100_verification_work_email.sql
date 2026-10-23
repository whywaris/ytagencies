-- Verified needs a company-domain email: a request waits as 'email_pending' until the one-time
-- link sent to a work email on the agency's own website domain is clicked, then it's 'requested'
-- (the admin queue). The proven domain and when it was proven are kept on the record. If the
-- agency later changes its website to another domain, an approved badge is flagged for re-check
-- (never removed automatically). schema.sql has the same objects.

begin;

alter table verifications drop constraint verifications_status_check;
alter table verifications add constraint verifications_status_check
  check (status in ('email_pending', 'requested', 'approved', 'rejected'));

alter table verifications
  add column verified_domain text check (char_length(verified_domain) <= 253),
  add column verified_email_at timestamptz,
  add column needs_recheck boolean not null default false;

-- One open request per agency, whether it's waiting for the email or for the admin.
drop index verifications_one_open;
create unique index verifications_one_open on verifications (agency_id)
  where status in ('email_pending', 'requested');

-- A website URL's host, lowercased, without "www.": https://www.Acme.com/x → acme.com.
create or replace function website_host(url text) returns text
language sql immutable set search_path = public as $$
  select nullif(lower(regexp_replace(coalesce(url, ''), '^[a-z]+://(www\.)?([^/:?#]+).*$', '\2', 'i')), '')
$$;

create or replace function flag_verified_domain_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if website_host(new.website) is distinct from website_host(old.website) then
    update verifications
    set needs_recheck = true
    where agency_id = new.id
      and status = 'approved'
      and verified_domain is not null
      and verified_domain is distinct from website_host(new.website);
  end if;
  return null;
end $$;
revoke execute on function flag_verified_domain_change() from public, anon, authenticated;

create trigger flag_verified_domain_change after update of website on agencies
  for each row execute function flag_verified_domain_change();

commit;
