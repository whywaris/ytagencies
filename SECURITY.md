# SECURITY.md

These rules are mandatory. If a task conflicts with them, stop and flag it.

## Secrets & environment

- Secrets live only in Vercel env vars and a local `.env.local` (git-ignored). Never commit them.
- Only variables prefixed `NEXT_PUBLIC_` may reach the browser. Exactly four are allowed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public by design; the secret stays server-side) and `NEXT_PUBLIC_GA_ID` (a Google Analytics measurement ID is public by design).
- `ALLOW_INDEXING` must be exactly `"true"` for search engines to index the site (lib/indexing.ts); otherwise every response carries `X-Robots-Tag: noindex, nofollow` and robots.txt disallows everything.
- Google Analytics loads only when `NEXT_PUBLIC_GA_ID` is set and `VERCEL_ENV` is `production`, only on public pages (never /admin, /dashboard, /login, /claim, /auth) and never for signed-in visitors (a Supabase session cookie, checked in the browser with no network call; signing in later in the tab switches GA off and stops events), with Consent Mode v2 defaults all denied until the visitor accepts. Events go through `lib/track.ts` and carry no personal data (no names, emails, messages or search text). The CSP allows only `www.googletagmanager.com` (scripts) and the Google Analytics hit hosts (connect, img).
- `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CLAIM_TOKEN_SECRET` and `YOUTUBE_API_KEY` (YouTube Data API v3, used only by admin verification) are server-only. Import them only in files with `import "server-only"` or route handlers, and never log them.
- `CRON_SECRET` is server-only. Scheduled routes under `/api/cron/` refuse any request without `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends it), compared in constant time.
- `PAYMENTS_ENABLED` is a server-side switch, not a secret. Anything that charges money stays off unless it is exactly `"true"`; while it's off the billing interface is a no-op.
- `CREEM_API_KEY` and `CREEM_WEBHOOK_SECRET` are server-only secrets, used only in `lib/billing/creem.ts` (`import "server-only"`) and never logged. `CREEM_PRODUCT_PRO_MONTHLY`, `CREEM_PRODUCT_PRO_YEARLY` and `CREEM_TEST_MODE` (exactly `"true"` = the test API) are server-only settings. Test keys only on Preview and local; live keys only on Production.
- Checkout needs `PAYMENTS_ENABLED` **and** the Creem keys. Only a signed-in owner (owner_id, set after a verified claim or an approved submission) can start a checkout, open the customer portal, switch to yearly or resume; every action re-checks ownership. The agency comes from the server, never from the browser's metadata.
- `/api/billing/webhook` verifies `creem-signature` (hex HMAC-SHA256 of the raw body with `CREEM_WEBHOOK_SECRET`) in constant time and answers 400 otherwise, before parsing anything. Events are recorded by Creem event id in `billing_events` (admin read only) and skipped once processed; older events never overwrite newer state. Subscriptions are written only by the webhook (service role) or an admin.
- Keep a `.env.example` with names and no values.

## Database (Supabase)

- Row Level Security is **enabled on every table**, with no exceptions.
- Public (anon) can only `select` rows where `status = 'published'`.
- Agency owners can update only their own agency (`owner_id = auth.uid()`).
- Leads are never readable by anon. Agencies see only leads routed to them.
- Admin actions check `profiles.role = 'admin'` in policy, not just in UI.
- Never build SQL with string concatenation. Use the Supabase client or parameterized RPCs.
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
  - Cloudflare Turnstile verified server-side.
  - Zod validation on the server.
  - Rate limiting per IP and per email (e.g. 5 submissions/hour), stored in a `rate_limits` table or Upstash.
  - Honeypot field.
- Turnstile is invisible on every form (a box appears only when Cloudflare wants a challenge) and every submit is verified server-side, failing closed. Production refuses Cloudflare test keys and missing keys, both at build time and on the server (lib/turnstile-keys.ts).
- Sign-in (magic link) uses Turnstile, is rate-limited per IP and per email (5 an hour, plus Supabase's own email limit) and has a honeypot. The response is the same whether or not the email has an account.
- Reviews: plain text only, length-capped, held for moderation before publishing.
- Contact messages (`contact_messages`) are written only by the server action (service role, after the checks above); nobody else can read or write them, and admins handle them in Admin → Inbox. The confirmation email to the sender contains nothing they typed, so the form can't be used to send spam through us; the admin copy shows a reported link as text and uses reply-to, not the sender as From.
- Never use `dangerouslySetInnerHTML` with user content.
- Guides (stored as Markdown in the database) are rendered server-side with remark/rehype and **rehype-sanitize**: no raw HTML, no scripts or event handlers, links get `rel="noopener"` and external ones open in a new tab. Never render guide Markdown in the browser or skip the sanitizer. Callouts (`> [!tip]`, `[!note]`, `[!warning]`) become an `<aside>` whose class the sanitizer allows only from a fixed list (`callout`, `callout-tip`, `callout-note`, `callout-warning`); no other class or id survives from Markdown (heading ids are added after sanitizing, from the heading text).

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

- `Content-Security-Policy` (allow self, Supabase, Turnstile, Vercel analytics).
  - `script-src` allows `'unsafe-inline'`: Next.js injects inline hydration scripts, and a nonce-based CSP would force every page to render dynamically, breaking ISR. Revisit if Next supports hashes for static pages.
  - Everything else stays strict: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and only the Supabase, Turnstile and Vercel origins that are needed.
- No CSP entry is needed for the site's own domain (`'self'`). Production is `https://ytagencies.com`; `www` redirects to it with a 308, so cookies and the session only ever live on the apex.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` restricting camera/mic/geolocation.

## External links

- Only managed agencies (live Pro) get a link to their website, with `rel="sponsored noopener"`, opening in a new tab. Unmanaged profiles have no outbound website link and no contact form; `contactAgency` refuses them server-side too.
- Dashboard URLs use the agency's slug (`/dashboard/<slug>/…`). The slug only finds the row: `getOwnedAgencyBySlug` also requires `owner_id` = the signed-in user (RLS applies too), so another agency's slug is a 404. Old `/dashboard/<id>` links 308 to the slug URL only for that agency's owner.
- Editing a listing needs ownership and a live Pro subscription: every dashboard mutation goes through `editableAgency()` (lib/actions/dashboard.ts).
- Marking an inquiry as contacted is also enforced in the database: the `lead_routes` update policy requires `agency_managed()` (the managed rule in SQL). A lapsed owner can still read inquiries received while on Pro, read-only. A submitted HQ city we don't list is stored as plain text (`hq_other`) for an admin to map; owners can't change it.
- `/claim/<slug>`: ownership still needs a confirmed email on the agency's domain or an admin approving a claim with proof (role, LinkedIn, note). A listing someone already owns can't be claimed: /claim shows only "already managed, email us", and both claim actions refuse it (lib/claim-rules.ts). Checkout for a pending submission is allowed only to its submitter, while it's an unowned draft.

## Privacy

- Leads contain personal data: collect only what matching needs, show a privacy notice on the form, and support deletion on request.
- Don't log full lead payloads or tokens.
- Publish a Privacy Policy and Terms before launch.

## Dependencies & ops

- Run `pnpm audit` before every release; enable Dependabot/Renovate.
- Enable Supabase daily backups and point-in-time recovery when on a paid plan.
- Separate Supabase projects for development and production.
