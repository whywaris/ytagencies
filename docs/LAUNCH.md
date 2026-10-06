# Launch checklist: YT Agencies (ytagencies.com)

## Supabase

1. Create a production project and run all of `supabase/schema.sql`. For an existing dev project, apply `supabase/migrations/` in order instead.
2. Seed production with taxonomy only (Part 1 of `seed.sql`), or run the whole seed and delete the samples:
   ```sql
   delete from agencies where id::text like '00000000-0000-4000-8000-%';
   ```
3. Auth settings:
   - Site URL: `https://ytagencies.com`
   - Redirect URLs: `https://ytagencies.com/auth/callback**` (plus `http://localhost:3000/auth/callback**` on the dev project only). Keep the trailing `**`: sign-in links carry `?next=`, and without the wildcard Supabase drops the URL and sends people to the Site URL instead.
   - Enable Google (OAuth client in Google Cloud; authorized domain `ytagencies.com`)
   - Custom SMTP through Resend, sender `hello@ytagencies.com`
4. Make yourself admin: `update profiles set role = 'admin' where id = '<your user id>';`
5. Daily backups and point-in-time recovery (paid plan).
6. Regenerate types: `pnpm dlx supabase gen types typescript --project-id <ref> --schema public > src/lib/supabase/types.ts`

## Vercel

1. Domains: add `ytagencies.com` as the primary domain and `www.ytagencies.com` redirecting to it (the app also 308s www → apex).
2. Environment variables for Production (Preview points at the dev project):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CLAIM_TOKEN_SECRET` (`openssl rand -base64 48`)
   - `SITE_URL=https://ytagencies.com` (production builds fall back to it; set it anyway, and set the preview URL on Preview)
   - `EMAIL_FROM` optional, defaults to `YT Agencies <hello@ytagencies.com>`
   - `ADMIN_EMAIL`
3. Enable Web Analytics.

## Cloudflare DNS (DNS-only, grey cloud)

1. Apex and `www` records pointing at Vercel, as Vercel's domain screen shows.
2. Turnstile widget for `ytagencies.com`.
3. Resend: verify `ytagencies.com` and add its SPF, DKIM and DMARC records.
4. Make `hello@ytagencies.com` a real, monitored inbox (shown on /privacy, /terms and in JSON-LD).

## Content and legal

1. Have `/privacy` and `/terms` reviewed; add the company's legal name and jurisdiction. Blocks launch.
2. Delete the sample agencies.
3. Write copy for each indexed combination page (Admin → Taxonomy shows "Missing") and the service intros.
4. Delete `src/app/styleguide/`.

## After deploy

1. End-to-end test with real services: magic link, Google sign-in, Turnstile, the three lead emails, a domain-matched claim, a logo upload.
2. Check `https://www.ytagencies.com/x` returns 308 to `https://ytagencies.com/x`, and canonicals, sitemaps and JSON-LD use `https://ytagencies.com`.
3. PageSpeed Insights on mobile: home, a directory page, a profile.
4. Google Search Console and Bing Webmaster Tools: verify `ytagencies.com` (domain property) and submit the three `/sitemaps/*.xml` files.
5. `pnpm audit`.
