-- Directory listing redesign: a one-line summary under the H1 of service × industry pages,
-- edited in Admin → Taxonomy → combination copy. Empty falls back to the intro's first sentence.

alter table service_industry_content
  add column summary text check (char_length(summary) <= 200);
