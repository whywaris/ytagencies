# SECURITY.md

These rules are mandatory. If a task conflicts with them, stop and flag it.

## Secrets & environment

- Secrets live only in Vercel env vars and a local `.env.local` (git-ignored). Never commit them.
- Only variables prefixed `NEXT_PUBLIC_` may reach the browser. Exactly three are allowed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_GA_ID` (a Google Analytics measurement ID is public by design).
- `ALLOW_INDEXING` must be exactly `"true"` for search engines to index the site (lib/indexing.ts); otherwise every response carries `X-Robots-Tag: noindex, nofollow` and robots.txt disallows everything.
- Google Analytics loads only when `NEXT_PUBLIC_GA_ID` is set and `VERCEL_ENV` is `production`, only on public pages (never /admin, /dashboard, /login, /claim, /auth) and never for signed-in visitors (a Supabase session cookie, checked in the browser with no network call; signing in later in the tab switches GA off and stops events), with Consent Mode v2 defaults all denied until the visitor accepts. Events go through `lib/track.ts` and carry no personal data (no names, emails, messages or search text). The CSP allows only `www.googletagmanager.com` (scripts) and the Google Analytics hit hosts (connect, img).
- `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CLAIM_TOKEN_SECRET` and `YOUTUBE_API_KEY` (YouTube Data API v3, used only by admin verification) are server-only. Import them only in files with `import "server-only"` or route handlers, and never log them.
- `CRON_SECRET` is server-only. Scheduled routes under `/api/cron/` refuse any request without `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends it), compared in constant time.
- `PAYMENTS_ENABLED` is a server-side switch, not a secret. Anything that charges money stays off unless it is exactly `"true"`; while it's off the billing interface is a no-op.
- `LEMONSQUEEZY_API_KEY` and `LEMONSQUEEZY_WEBHOOK_SECRET` are server-only secrets, used only in `lib/billing/lemonsqueezy.ts` (`import "server-only"`) and never logged. `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_VARIANT_MONTHLY`, `LEMONSQUEEZY_VARIANT_YEARLY` and `LEMONSQUEEZY_TEST_MODE` (exactly `"true"` = test mode) are server-only settings. Test keys and test mode only on Preview and local; live keys only on Production (the production build warns if test mode is on).
- Checkout needs `PAYMENTS_ENABLED` **and** the Lemon Squeezy settings. Only a signed-in owner (owner_id, set after a verified claim or an approved submission) can start a checkout or open the customer portal; every action re-checks ownership. The agency comes from the server, never from the browser's custom data.
- `/api/webhooks/lemonsqueezy` verifies `X-Signature` (hex HMAC-SHA256 of the raw body with `LEMONSQUEEZY_WEBHOOK_SECRET`) in constant time and answers 400 otherwise, before parsing anything. Lemon Squeezy sends no event id, so events are recorded in `billing_events` (admin read only) by event name + object + its `updated_at` and skipped once processed; older events never overwrite newer state. Test-mode events are acknowledged and ignored unless `LEMONSQUEEZY_TEST_MODE` is `"true"`, so a test purchase can't grant Pro on the live site. Subscriptions are written only by the webhook (service role) or an admin. Old Creem rows in `billing_events` are kept.
- Keep a `.env.example` with names and no values.

## Database (Supabase)

- Row Level Security is **enabled on every table**, with no exceptions.
- Public (anon) can only `select` rows where `status = 'published'`.
- Agency owners can update only their own agency (`owner_id = auth.uid()`).
- Leads are never readable by anon. Agencies see only leads routed to them, and their contact details (the `leads` row: name, email, company, links, message) only while on Pro (`agency_managed()` in the read policy). Free owners read previews through `lead_previews()`, which returns no contact columns; summaries are redacted when the lead is saved (`lib/lead-preview.ts`).
- Unclaimed listings' outreach addresses (`agency_outreach_contacts`) and the outreach log are admin and service role only. Outreach emails carry a signed unsubscribe link (its own HMAC label) and `List-Unsubscribe`; GET only shows a button, POST records the opt-out.
- Admin actions check `profiles.role = 'admin'` in policy, not just in UI.
- Never build SQL with string concatenation. Use the Supabase client or parameterized RPCs.
- No SECURITY DEFINER views: views are `security_invoker`. An aggregate the public needs over private rows is a SECURITY DEFINER function returning only those columns, with `search_path` set (`agency_response_times()`). Every function sets `search_path`; trigger functions have EXECUTE revoked from anon and authenticated. `is_admin()` stays executable by anon and authenticated (policies on the public role call it); `agency_managed()` and `lead_previews()` by authenticated only. `rate_limits` and `page_view_events` have RLS with no policies: service role only. `supabase/tests/access.mjs` checks all of this.
- Plans, subscriptions, sponsored slots, verifications, agency events, app settings and the admin audit log are admin-write only.
- Guide authors are admin-write only. The public reads an author only once they have a live guide, and never `authors.user_id` (column grants). Author links must be `https://`; author photos follow the upload rules below. Owners may read their own subscription, verification and daily event rollups; anon reads none of them (public pages read what they need server-side with the service role).
- `agencies.is_verified` is derived from an approved row in `verifications` by a trigger. Don't write the flag directly.
- Every admin mutation writes one row to `admin_actions` (ids and field names, never personal data). The log is append-only, even for admins.

## Auth

- Supabase Auth with email magic link (token-hash links via `/auth/confirm`) and Google OAuth (`/auth/google` → `/auth/callback`; the button shows only while Google is enabled in Supabase). No passwords.
- **Claiming a listing** requires verifying an email on the agency's own website domain (e.g. `@acmemedia.com`), or manual admin approval. Never auto-grant ownership.
- Dashboard and admin routes are protected in middleware **and** re-checked in server actions.

## Forms & input

- Every public form (get-matched, contact agency, contact us, review, claim) has:
  - Zod validation on the server.
  - Rate limiting per IP and per email (e.g. 5 submissions/hour), stored in a `rate_limits` table or Upstash.
  - Honeypot field.
- Lead summaries (the free owner's preview) are redacted on save and again when read: emails (also written as "at/dot"), phone numbers however spaced, any URL or bare domain, and @handles, plus the sender's own name and company (`redactSummary`, tested with tricky input).
- No CAPTCHA (Cloudflare Turnstile was removed on purpose): bots are held back by the honeypot and the rate limits.
- Sign-in (magic link) is rate-limited per IP and per email (5 an hour, plus Supabase's own email limit) and has a honeypot. The response is the same whether or not the email has an account.
- Reviews: plain text only, length-capped, held for moderation before publishing.
- Contact messages (`contact_messages`) are written only by the server action (service role, after the checks above); nobody else can read or write them, and admins handle them in Admin → Inbox. The confirmation email to the sender contains nothing they typed, so the form can't be used to send spam through us; the admin copy shows a reported link as text and uses reply-to, not the sender as From.
- Never use `dangerouslySetInnerHTML` with user content.
- Guides are stored as editor JSON and sanitized on the server on every save with an allowlist (`sanitizeDoc`, lib/guide-content.ts): known nodes, marks and attributes only; links only http(s), mailto, site-relative and anchors (no `javascript:`); images only from our storage; no iframes, scripts or event handlers. The stored HTML is rendered from that clean JSON. Pasted HTML goes through `cleanPastedHtml` (drops script, iframe, object, form, styles and every attribute not on its list). Older Markdown guides are rendered server-side with rehype-sanitize. Callouts (`> [!tip]`, `[!note]`, `[!warning]`) become an `<aside>` whose class the sanitizer allows only from a fixed list (`callout`, `callout-tip`, `callout-note`, `callout-warning`); no other class or id survives from Markdown (heading ids are added after sanitizing, from the heading text).

## Analytics beacon (`POST /api/events`)

- Accepts only `profile_view`, `website_click` and `contact_open` for a published agency, from the same origin (checked `Origin`). Inquiries are counted server-side when a lead is routed, never from the browser.
- Ignores bots (user-agent check) and is rate-limited per IP (hashed key, 120 an hour). Always answers 204, so it reveals nothing.
- Stores `visitor_hash` only: an HMAC of IP + user agent with a key that changes every UTC day (derived from `CLAIM_TOKEN_SECRET`). No raw IP or user agent is stored, and visitors can't be linked across days.
- One event per visitor, agency, type and day. Raw events are pruned after 90 days; daily rollups (`agency_event_daily`) are kept.
- Directory pages send `{ type: "page_view", path }` the same way: the path must be a real service (and industry or location) page, and it's counted once per visitor per path per day in `page_view_events` (pruned after 90 days) and `page_view_daily`. Both are admin-read only; owners see only aggregates for their own services on the dashboard, read server-side after the ownership check.

## Image links (guide covers)

- Guide covers are links to images on our own Cloudflare host, not uploads. Only `https://` links on a host in `MEDIA_HOSTS` are accepted (checked on the server when saving); the CSP `img-src` and `next/image` allow exactly those hosts. Never widen this to arbitrary hosts.

## Uploads (logos, case-study images)

- Storage bucket policies: owners write to `agencies/<agency_id>/` only.
- Allowed types: png, jpg, webp, svg is **not** allowed (XSS risk). Max 2 MB.
- Re-validate MIME type server-side; don't trust the file extension.

## HTTP headers (next.config)

- `Content-Security-Policy` (allow self, Supabase, Vercel analytics).
  - `script-src` allows `'unsafe-inline'`: Next.js injects inline hydration scripts, and a nonce-based CSP would force every page to render dynamically, breaking ISR. Revisit if Next supports hashes for static pages.
  - Everything else stays strict: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and only the Supabase and Vercel origins that are needed.
- No CSP entry is needed for the site's own domain (`'self'`). Production is `https://ytagencies.com`; `www` redirects to it with a 308, so cookies and the session only ever live on the apex.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` restricting camera/mic/geolocation.

## External links

- Only agencies on Pro get a link to their website, with `rel="sponsored noopener"`, opening in a new tab. Every profile takes quote requests (`contactAgency`); who sees the contact details is decided server-side (lib/leads.tsx).
- Dashboard URLs use the agency's slug (`/dashboard/<slug>/…`). The slug only finds the row: `getOwnedAgencyBySlug` also requires `owner_id` = the signed-in user (RLS applies too), so another agency's slug is a 404. Old `/dashboard/<id>` links 308 to the slug URL only for that agency's owner.
- Editing a listing needs ownership: every dashboard mutation goes through `editableAgency()`, and Pro-only ones (booking buttons, channels, marking contacted) through `proAgency()` (lib/actions/dashboard.ts). `tests/security.test.mjs` fails if an exported server action has no ownership or admin check.
- Marking an inquiry as contacted is also enforced in the database: the `lead_routes` update policy requires `agency_managed()` (the managed rule in SQL). A lapsed owner falls back to previews. A submitted HQ city we don't list is stored as plain text (`hq_other`) for an admin to map; owners can't change it.
- `/claim/<slug>`: ownership still needs a confirmed email on the agency's domain or an admin approving a claim with proof (role, LinkedIn, note). A listing someone already owns can't be claimed: /claim shows only "already managed, email us", and both claim actions refuse it (lib/claim-rules.ts). Checkout for a pending submission is allowed only to its submitter, while it's an unowned draft.

## Privacy

- Leads contain personal data: collect only what matching needs, show a privacy notice on the form, and support deletion on request.
- Don't log full lead payloads or tokens.
- Publish a Privacy Policy and Terms before launch.

## Dependencies & ops

- Run `pnpm audit` before every release; enable Dependabot/Renovate.
- Enable Supabase daily backups and point-in-time recovery when on a paid plan.
- Separate Supabase projects for development and production.
