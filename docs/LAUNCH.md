# Launch checklist: YT Agencies (ytagencies.com)

## Supabase

1. Create a production project and run all of `supabase/schema.sql`. For an existing dev project, apply `supabase/migrations/` in order instead.
2. Seed production with taxonomy only (Part 1 of `seed.sql`), or run the whole seed and delete the samples:
   ```sql
   delete from agencies where id::text like '00000000-0000-4000-8000-%';
   ```
3. Auth settings:
   - Site URL: `https://ytagencies.com`
   - Redirect URLs (Authentication → URL Configuration). The app builds sign-in redirects on the request's own origin when it's the site or a local dev server, else on `SITE_URL`, so list every origin you sign in from:
     - Production project: `https://ytagencies.com/auth/callback**`
     - Dev project: `http://localhost:3000/auth/callback**` and `http://localhost:3001/auth/callback**` (the second is the port used for production builds with `next start -p 3001`), plus your Preview URL's `/auth/callback**` if you test sign-in there.

     Keep the trailing `**`: sign-in links carry `?next=`, and without the wildcard Supabase drops the URL and sends people to the Site URL instead. A URL that isn't listed fails the same way. On localhost the session cookie is shared across ports, so an email link that lands on `:3000` (the dev Site URL) also signs you in on `:3001`.
   - Leave Google and other social providers off: the app signs in by email link only.
   - Custom SMTP through Resend and a higher email rate limit: see "Supabase email" below.
   - Email templates (Authentication → Email Templates). Email links must go to `/auth/confirm` (token hash), so they work when opened in a different browser or device; the default `{{ .ConfirmationURL }}` uses PKCE and fails there with "expired or already used". Set the link in both **Magic Link** and **Confirm signup** to:
     ```html
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Sign in to YT Agencies</a>
     ```
     `{{ .RedirectTo }}` is the full `/auth/callback?next=…` URL the app sends; `/auth/confirm` accepts it only for this site's own origin and keeps just the path. Do this on the dev project too.
4. Make yourself admin: `update profiles set role = 'admin' where id = '<your user id>';`
5. Daily backups and point-in-time recovery (paid plan).
6. Regenerate types: `pnpm dlx supabase gen types typescript --project-id <ref> --schema public > src/lib/supabase/types.ts`

## Supabase email (custom SMTP via Resend)

Supabase's built-in email is for testing only: it sends a couple of emails an hour and only to members of your Supabase team. Past that, `signInWithOtp` fails with `over_email_send_rate_limit` and the sign-in form says "Too many sign-in emails were sent". Set this up on the dev and production projects:

1. Resend: verify `ytagencies.com` (DNS records under Cloudflare DNS below) and create an API key with sending access.
2. Supabase → Authentication → Emails → SMTP Settings → enable custom SMTP:
   - Host `smtp.resend.com`, port `465` (SSL)
   - Username `resend`, password: the Resend API key
   - Sender email `hello@ytagencies.com`, sender name `YT Agencies`
3. Supabase → Authentication → Rate Limits → "Rate limit for sending emails": raise it from the default (e.g. to 100 an hour). It only becomes editable once custom SMTP is on. The app also limits each IP and email to 5 sign-in requests an hour.
4. Send yourself a magic link and check it arrives. If the form says "Our email service didn't respond" (Supabase answers 504 after ~30 seconds), Supabase can't reach the SMTP server: recheck host, port and password, and see Supabase → Logs → Auth for the exact SMTP error. Otherwise a failure is logged a failure is logged as `signInWithOtp failed` with Supabase's error code and message (email addresses masked).

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

1. End-to-end test with real services: magic link (opened in a different browser than the one that asked for it), Turnstile, the three lead emails, a domain-matched claim, a logo upload.
2. Check `https://www.ytagencies.com/x` returns 308 to `https://ytagencies.com/x`, and canonicals, sitemaps and JSON-LD use `https://ytagencies.com`.
3. PageSpeed Insights on mobile: home, a directory page, a profile.
4. Google Search Console and Bing Webmaster Tools: verify `ytagencies.com` (domain property) and submit the three `/sitemaps/*.xml` files.
5. `pnpm audit`.
