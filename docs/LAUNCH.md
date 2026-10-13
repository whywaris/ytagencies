# Launch checklist: YT Agencies (ytagencies.com)

## Supabase

1. Create a production project and run all of `supabase/schema.sql` (SQL editor). It already contains everything the migrations in `supabase/migrations/` add, so on a fresh project don't run the migrations on top of it. Then mark them all as applied for the Supabase CLI (see "Supabase CLI" below, "Production project"), so `pnpm db:push` only ever runs migrations added after launch. Do this before the first deploy: the build reads the database while pre-rendering pages and fails if a table or column the code expects is missing. On the dev project, apply new migrations with `pnpm db:push`.
   - Defaults after `20261018000100_pricing_response.sql`: existing agencies have no minimum contract, ad spend or setup fee (nothing shows until they save their profile, where the first two are now required), and response times start empty. An agency's "Usually replies within…" appears only once it has marked 3 inquiries as contacted in the last 90 days.
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
   - Enable Google (Authentication → Providers → Google), on the dev and production projects:
     1. Google Cloud → APIs & Services → OAuth consent screen: app name "YT Agencies", support email `help@ytagencies.com`, authorized domains `ytagencies.com` and `supabase.co`.
     2. Credentials → Create OAuth client ID → Web application. Authorized JavaScript origins: `https://ytagencies.com` (plus `http://localhost:3000` on the dev client). Authorized redirect URI: the callback shown on the Supabase Google provider page, `https://<project-ref>.supabase.co/auth/v1/callback` (dev: `https://lkpmdqybxkhirlsqhffs.supabase.co/auth/v1/callback`).
     3. Paste the client ID and secret into the Supabase Google provider and save.
     4. After Google, Supabase sends people back to `/auth/callback?next=…`, so the Redirect URLs above must list `/auth/callback**` for every origin you sign in from (they already do).

     The "Continue with Google" button on /login appears only while the provider is enabled (checked every 5 minutes). Leave other social providers off.
   - Custom SMTP through Resend and a higher email rate limit: see "Supabase email" below.
   - Email templates (Authentication → Email Templates). Email links must go to `/auth/confirm` (token hash), so they work when opened in a different browser or device; the default `{{ .ConfirmationURL }}` uses PKCE and fails there with "expired or already used". Set the link in both **Magic Link** and **Confirm signup** to:
     ```html
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Sign in to YT Agencies</a>
     ```
     `{{ .RedirectTo }}` is the full `/auth/callback?next=…` URL the app sends; `/auth/confirm` accepts it only for this site's own origin and keeps just the path. Do this on the dev project too. Google sign-in still uses `/auth/callback`.
4. Make yourself admin: `update profiles set role = 'admin' where id = '<your user id>';`
5. Daily backups and point-in-time recovery (paid plan).
6. Regenerate types after a schema change: `pnpm db:types` (needs the CLI linked, below).

## Supabase CLI (apply migrations with one command)

The scripts run the CLI through `pnpm dlx supabase`: no global install, it downloads the Windows binary on first use. If that fails, install it with Scoop (`scoop bucket add supabase https://github.com/supabase/scoop-bucket.git`, then `scoop install supabase`) and run the same commands with `supabase` instead of `pnpm dlx supabase`. Docker isn't needed: nothing runs locally. `supabase/config.toml` holds the little the CLI needs.

| Script | Does |
|---|---|
| `pnpm db:link <ref>` | Links this folder to a project (asks for its database password). |
| `pnpm db:status` | Lists migrations: local files vs. what the linked project has recorded. |
| `pnpm db:push` | Applies the migrations the linked project hasn't recorded yet, in order. |
| `pnpm db:types` | Regenerates `src/lib/supabase/types.ts` from the linked project. |

### Dev project (`lkpmdqybxkhirlsqhffs`): one-time setup in PowerShell

Every migration up to `20261018000100` was pasted into the SQL editor by hand, so the CLI's history is empty and `db push` would try to run them all again. Mark them as applied first. All 16 were checked against the dev database on 2026-10-12:

```powershell
cd "C:\Users\LENOVO\Desktop\YT Agency"
pnpm dlx supabase login
pnpm db:link lkpmdqybxkhirlsqhffs
pnpm dlx supabase migration repair --status applied 20261004000000 20261005000100 20261005000200 20261006000100 20261007000100 20261008000100 20261009000100 20261010000100 20261011000100 20261012000100 20261013000100 20261014000100 20261015000100 20261016000100 20261017000100 20261018000100
pnpm db:status
```

`login` opens the browser. `db:link` asks for the database password (Project Settings → Database; reset it there if you don't have it). `db:status` should then show every migration under both Local and Remote. From then on, after pulling a new migration: `pnpm db:push`.

To check a database before repairing (production later, or to double-check dev), paste this into its SQL editor. It checks one object each migration created and shows `true` for the applied ones; list only those in the repair command:

```sql
select version, applied from (values
  ('20261004000000', to_regclass('public.rate_limits') is not null),
  ('20261005000100', exists (select 1 from pg_policies where tablename = 'agency_services' and policyname = 'anon read published')),
  ('20261005000200', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'services' and column_name = 'updated_at')),
  ('20261006000100', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agencies' and column_name = 'submitted_by')),
  ('20261007000100', to_regclass('public.plans') is not null),
  ('20261008000100', to_regclass('public.admin_agency_list') is not null),
  ('20261009000100', not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agencies' and column_name = 'is_featured')),
  ('20261010000100', to_regclass('public.guides') is not null),
  ('20261011000100', to_regclass('public.app_settings') is not null),
  ('20261012000100', to_regclass('public.authors') is not null),
  ('20261013000100', to_regclass('public.contact_messages') is not null),
  ('20261014000100', to_regclass('public.deleted_agency_routes') is not null),
  ('20261015000100', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'case_studies' and column_name = 'channel_id')),
  ('20261016000100', exists (select 1 from pg_constraint where conname = 'plans_id_check' and pg_get_constraintdef(oid) like '%pro%')),
  ('20261017000100', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agency_event_daily' and column_name = 'source')),
  ('20261018000100', to_regclass('public.agency_response_times') is not null)
) as m(version, applied)
order by version;
```

### Production project (later)

After creating it from `schema.sql` (step 1), in PowerShell:

```powershell
pnpm db:link <production-ref>
pnpm dlx supabase migration repair --status applied <every version the query shows as true>
pnpm db:status
```

On a fresh project built from `schema.sql`, every row is `true`, so the repair lists all of them. After that, push each new migration to dev first and production second: `db:link` switches the folder between projects, so run `pnpm db:status` to see which one you're on before `pnpm db:push`.

## Supabase email (custom SMTP via Resend)

Supabase's built-in email is for testing only: it sends a couple of emails an hour and only to members of your Supabase team. Past that, `signInWithOtp` fails with `over_email_send_rate_limit` and the sign-in form says "Too many sign-in emails were sent". Set this up on the dev and production projects:

1. Resend: verify the sending subdomain `send.ytagencies.com` (DNS records under Cloudflare DNS below) and create an API key with sending access.
2. Supabase → Authentication → Emails → SMTP Settings → enable custom SMTP:
   - Host `smtp.resend.com`, port `465` (SSL)
   - Username `resend`, password: the Resend API key
   - Sender email `help@send.ytagencies.com`, sender name `YT Agencies`. Replies to sign-in emails then go to that address, which has no inbox; that's fine for sign-in links.
3. Supabase → Authentication → Rate Limits → "Rate limit for sending emails": raise it from the default (e.g. to 100 an hour). It only becomes editable once custom SMTP is on. The app also limits each IP and email to 5 sign-in requests an hour.
4. Send yourself a magic link and check it arrives. If the form says "Our email service didn't respond" (Supabase answers 504 after ~30 seconds), Supabase can't reach the SMTP server: recheck host, port and password, and see Supabase → Logs → Auth for the exact SMTP error. Otherwise a failure is logged as `signInWithOtp failed` with Supabase's error code and message (email addresses masked).

## Vercel

1. Domains: add `ytagencies.com` as the primary domain and `www.ytagencies.com` redirecting to it (the app also 308s www → apex).
2. Environment variables. Set all of them on **Production** (pointing at the production Supabase project) and on **Preview** (pointing at the dev project); copy the same names into `.env.local` for local work (`.env.example` lists them). Only the three `NEXT_PUBLIC_` ones reach the browser (SECURITY.md).

   | Variable | Scope | Required | What it does / how to get it |
   |---|---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | public | yes | Supabase → Project Settings → API. |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | yes | Same page, `anon` key. |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | public | yes | Cloudflare Turnstile widget for `ytagencies.com`. |
   | `SUPABASE_SERVICE_ROLE_KEY` | server | yes | Same Supabase page, `service_role` key. Admin, cron and public data functions use it. |
   | `TURNSTILE_SECRET_KEY` | server | yes | The widget's secret key. Every public form checks it. |
   | `RESEND_API_KEY` | server | yes | Resend API key (sending access, `send.ytagencies.com`). Without it no lead or rejection emails go out. |
   | `CLAIM_TOKEN_SECRET` | server | yes | `openssl rand -base64 48`. Signs claim links and keys the daily visitor hash of the analytics beacon. Changing it voids pending claim links. Unset: claims fail and the beacon records nothing. |
   | `CRON_SECRET` | server | yes | `openssl rand -base64 32`. Vercel sends it to `/api/cron/*`; without it those routes answer 401 and nothing scheduled runs. |
   | `YOUTUBE_API_KEY` | server | yes | Google Cloud → enable "YouTube Data API v3" → create an API key restricted to that API. Used by admin verification and the monthly stats check (well within the free 10,000 units/day). |
   | `SITE_URL` | server | yes | `https://ytagencies.com` on Production, the preview URL on Preview, `http://localhost:3000` locally. Builds canonicals, sitemaps, JSON-LD and email links. |
   | `ADMIN_EMAIL` | server | recommended | Gets a note for every new lead, agency submission and claim that needs review. Unset: those notes are skipped (the admin queues still show everything). |
   | `EMAIL_FROM` | server | no | Defaults to `YT Agencies <help@send.ytagencies.com>` (the Resend-verified subdomain). Every email the app sends sets Reply-To `help@ytagencies.com`, except lead emails to agencies, which reply to the business. |
   | `MEDIA_HOSTS` | server | yes | Host name(s) of your Cloudflare image hosting, comma-separated, e.g. `images.ytagencies.com` (an R2 bucket on a custom domain) or `imagedelivery.net` (Cloudflare Images). Guide covers are pasted links and must be on one of these; it also opens the CSP `img-src` and `next/image` to them. Changing it needs a redeploy. |
   | `PAYMENTS_ENABLED` | server | no | Only exactly `true` turns checkout on (with the Creem variables below). While off nothing is charged and "Get Pro" opens the Request Pro form (Admin → Inbox); grant Pro in Agencies → Change plan. |
   | `CREEM_API_KEY` | server, secret | for payments | Creem API key. Test key on Preview/local, live key on Production ("Creem" below). |
   | `CREEM_WEBHOOK_SECRET` | server, secret | for payments | The webhook's signing secret from Creem. Without it, payments don't update plans. |
   | `CREEM_PRODUCT_PRO_MONTHLY` | server | for payments | Product id of "YT Agencies Pro" monthly (`prod_…`). |
   | `CREEM_PRODUCT_PRO_YEARLY` | server | for payments | Product id of "YT Agencies Pro" yearly (`prod_…`). |
   | `CREEM_TEST_MODE` | server | no | `true` uses Creem's test API (`test-api.creem.io`). Set on Preview and local; leave unset on Production. |

3. Enable Web Analytics.
4. Cron jobs come from `vercel.json` and run on Production only:
   - `/api/cron/verification-stats` on the 1st of each month at 06:00 UTC (re-checks verified channels' YouTube stats).
   - `/api/cron/guides` daily at 07:00 UTC. It refreshes guides whose scheduled time passed (guide pages also refresh hourly, so a scheduled guide appears within an hour either way; on Vercel Pro you can run it every 15 minutes, `*/15 * * * *`), sends the one "A business is waiting for your reply" email for leads not marked contacted after 24 hours, and deletes data past its retention period: leads after 24 months, closed contact messages 12 months after closing (set in `src/lib/company.ts`, shown in the privacy policy). Its response and logs hold counts only.
   After the first deploy, check both under Project → Settings → Cron Jobs and run each once with "Run" to see a 200.

## Creem (payments for Pro)

Creem is the merchant of record: it charges, handles tax and sends receipts and invoices. Test mode and live mode are separate (keys, products and webhooks don't carry over).

1. **Account and verification.** Sign up at creem.io, create the store "YT Agencies", and complete account verification in the dashboard (Balances → Payout Account). Live payments need it; test mode works before it.
2. **Products (test mode first).** Toggle Test Mode (bottom of the left sidebar). Create two recurring products, both named "YT Agencies Pro": $29, billed every month, and $279, billed every year. The Creem docs only let an existing customer switch plans between products in a bundle with self-service upgrades, so also put both in one product bundle if you want switching from the portal (our "Switch to yearly" button works either way, through the API). Copy each product id (`prod_…`).
3. **Webhook (test).** Developers → Webhooks → add an endpoint. Dev: a tunnel to your machine (e.g. `ngrok http 3000`, then `https://<tunnel>/api/billing/webhook`), or the Preview deployment's URL plus `/api/billing/webhook`. Copy its signing secret.
4. **Keys (test).** Developers → API keys (with Test Mode on) → copy the test key.
5. **Env (Preview and `.env.local`).** `CREEM_API_KEY` = test key, `CREEM_WEBHOOK_SECRET` = test webhook secret, `CREEM_PRODUCT_PRO_MONTHLY` / `CREEM_PRODUCT_PRO_YEARLY` = the test product ids, `CREEM_TEST_MODE=true`, `PAYMENTS_ENABLED=true`. Admin → Settings → Payments then says "On (test mode)".
6. **Test the flow.** As an agency owner: Dashboard → Billing → Get Pro (monthly). Pay with `4111 1111 1111 1111`, any future date, any CVC. You land on Billing with "Payment received"; within seconds the plan shows Pro, the profile gets its contact form, and you get "You're on Pro". Then check:
   - Admin → Plans: source Payment, the `sub_…` id, last event "Payment received".
   - Billing → Switch to yearly: the interval changes after the webhook.
   - Billing → Manage billing opens the Creem portal; cancel there: the plan ends (the portal cancels immediately) and "Your Pro plan has ended" arrives.
   - A declined card (`4507 9900 0000 0028`) at checkout shows Creem's error and changes nothing.
   - Creem dashboard → Developers → Webhooks: every delivery answered 200. Resending one is ignored (already processed).
7. **Go live.** Turn Test Mode off and repeat steps 2–4 in live mode: create the two products again (new ids), add the webhook `https://ytagencies.com/api/billing/webhook` (new secret), copy the live API key. On Vercel **Production** set the live values, leave `CREEM_TEST_MODE` unset, and set `PAYMENTS_ENABLED=true`, then redeploy. Make one real $29 purchase on your own agency, then refund it in Creem (a full refund ends Pro straight away).
8. **Ongoing.** Refunds and cancellations happen in the Creem dashboard; the webhook updates the plan. Ending a paid plan from Admin → Change plan only changes our side, so cancel it in Creem too.

## Cloudflare DNS (DNS-only, grey cloud)

1. Apex and `www` records pointing at Vercel, as Vercel's domain screen shows.
2. Turnstile widget for `ytagencies.com`.
3. Resend: add the domain `send.ytagencies.com` and create its SPF, DKIM and DMARC records in Cloudflare (DNS-only). The app sends from `help@send.ytagencies.com`.
4. Cloudflare Email Routing (Email → Email Routing on `ytagencies.com`): enable it (it adds its MX and SPF records on the apex) and create the custom address `help@ytagencies.com` forwarding to your own inbox; verify that destination address. `help@ytagencies.com` is the only public address: the contact form (every topic), the legal pages, the footer, JSON-LD and the Reply-To on every email. Sending uses the `send.` subdomain, so routing on the apex doesn't conflict.

## Content and legal

1. Fill in every TODO in `src/lib/company.ts` (`pnpm build` prints the list): legal name, country, city, jurisdiction, response times, founder, guide review cycle, and the payment provider before payments go live. Pages hide what's missing until then.
2. Have `/privacy`, `/terms`, `/refunds` and `/cookies` reviewed for your jurisdiction. Blocks launch. If the code starts setting a new cookie, add it to `/cookies`.
3. Delete the sample agencies.
4. Write copy for each indexed combination page (Admin → Taxonomy shows "Missing") and the service intros.
5. Delete `src/app/styleguide/`.

## After deploy

1. End-to-end test with real services: a Creem test purchase ("Creem" step 6), magic link (opened in a different browser than the one that asked for it), Google sign-in, Turnstile, the three lead emails, a domain-matched claim, a logo upload, a verification lookup (YouTube API), and a guide image upload.
2. Check `https://www.ytagencies.com/x` returns 308 to `https://ytagencies.com/x`, and canonicals, sitemaps and JSON-LD use `https://ytagencies.com`.
3. PageSpeed Insights on mobile: home, a directory page, a profile.
4. Google Search Console and Bing Webmaster Tools: verify `ytagencies.com` (domain property) and submit the three `/sitemaps/*.xml` files.
5. `pnpm audit`. Known at launch: one high advisory in `braces` (GHSA-vfj7-8cjw-p6xm), pulled in only by dev tooling (eslint, the shadcn CLI). It isn't in the deployed app and has no patched release yet; update when one ships.
