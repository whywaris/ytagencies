-- WYSIWYG guide editor (Tiptap) and drafts. schema.sql has the same result for fresh projects.
--
-- 1. Content is Tiptap JSON (body_json) plus the sanitized HTML rendered from it on the server
--    (body_html). body_md stays as the backup of the old Markdown; it isn't deleted or edited.
--    Existing guides are converted from Markdown by the app (lib/guide-content.ts markdownToDoc):
--    automatically when a guide without body_json is shown or opened in the editor, and all at
--    once with `pnpm guides:convert` (SQL can't parse Markdown).
-- 2. Drafts: editing a published guide saves to draft_json/draft_html; the live page changes only
--    on "Update", which copies the draft into body_json/body_html and stamps content_updated_at
--    (shown as "Updated" and used as the Article's dateModified).
-- 3. The public (anon) and signed-in users can't read drafts or the Markdown backup: column grants.
--    Admin pages read guides with the service role.
-- 4. Storage bucket guide-media: public read, admin-only write, jpg/png/webp/gif up to 5 MB.

begin;

-- 1–2. Columns
alter table guides
  add column body_json jsonb,
  add column body_html text check (char_length(body_html) <= 400000),
  add column draft_json jsonb,
  add column draft_html text check (char_length(draft_html) <= 400000),
  add column draft_updated_at timestamptz,
  add column content_updated_at timestamptz;
comment on column guides.body_md is 'Backup of the Markdown body from before the Tiptap editor. Read-only.';
-- Live guides were last updated when they were last saved.
update guides set content_updated_at = updated_at where status in ('published', 'scheduled');

-- 3. Column grants: everything public except drafts and the Markdown backup.
revoke select on guides from anon, authenticated;
grant select (id, slug, title, excerpt, cover_path, seo_title, seo_description, author_id, status,
  published_at, related_combos, key_takeaways, numbered_sections, created_at, updated_at,
  body_json, body_html, content_updated_at, body_md)
  on guides to anon, authenticated;

-- 4. Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guide-media', 'guide-media', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy "admins read guide media" on storage.objects for select to authenticated
  using (bucket_id = 'guide-media' and is_admin());
create policy "admins write guide media" on storage.objects for insert to authenticated
  with check (bucket_id = 'guide-media' and is_admin());
create policy "admins update guide media" on storage.objects for update to authenticated
  using (bucket_id = 'guide-media' and is_admin()) with check (bucket_id = 'guide-media' and is_admin());
create policy "admins delete guide media" on storage.objects for delete to authenticated
  using (bucket_id = 'guide-media' and is_admin());

commit;
