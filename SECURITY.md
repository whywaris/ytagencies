# SECURITY.md

These rules are mandatory. If a task conflicts with them, stop and flag it.

## Secrets & environment

- Secrets live only in Vercel env vars and a local `.env.local` (git-ignored). Never commit them.
- Only variables prefixed `NEXT_PUBLIC_` may reach the browser. Exactly four are allowed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GA_ID` (a Google Analytics measurement ID is public by design) and `NEXT_PUBLIC_ADS_ENABLED` (a switch).
- `ALLOW_INDEXING` must be exactly `"true"` for search engines to index the site (lib/indexing.ts); otherwise every response carries `X-Robots-Tag: noindex, nofollow` and robots.txt disallows everything.
- Google Analytics loads only when `NEXT_PUBLIC_GA_ID` is set and `VERCEL_ENV` is `production`, only on public pages (never /admin, /login, /auth) and never for signed-in visitors (a Supabase session cookie, checked in the browser with no network call; signing in later in the tab switches GA off and stops events), with Consent Mode v2 defaults all denied until the visitor accepts. Events go through `lib/track.ts` and carry no personal data (no names, emails, messages or search text). The CSP allows only `www.googletagmanager.com` (scripts) and the Google Analytics hit hosts (connect, img).
- Google AdSense (`lib/ads.ts`) loads only with `NEXT_PUBLIC_ADS_ENABLED=1` on Production, and only on guide articles: never on admin or sign-in pages. The CSP always allows the AdSense hosts (`next.config.ts`), and no others. Consent in the EEA, UK and Switzerland is Google's own certified message, set up in AdSense → Privacy & messaging; turn it on before enabling ads.
- `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are server-only. Import them only in files with `import "server-only"` or route handlers, and never log them.
- `CRON_SECRET` is server-only. Scheduled routes under `/api/cron/` refuse any request without `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends it), compared in constant time.
- Keep a `.env.example` with names and no values.

## Database (Supabase)

- Row Level Security is **enabled on every table**, with no exceptions.
- Public (anon) can only `select` rows where `status = 'published'` (live guides, authors with a live guide).
- The directory's tables (agencies, leads, claims, reviews, plans, outreach…) are still in the database, unused since the site became a blog. Their RLS stays as it was; nothing in the app reads or writes them.
- Admin actions check `profiles.role = 'admin'` in policy, not just in UI.
- Never build SQL with string concatenation. Use the Supabase client or parameterized RPCs.
- No SECURITY DEFINER views: views are `security_invoker`. An aggregate the public needs over private rows is a SECURITY DEFINER function returning only those columns, with `search_path` set (`agency_response_times()`). Every function sets `search_path`; trigger functions have EXECUTE revoked from anon and authenticated. `is_admin()` stays executable by anon and authenticated (policies on the public role call it); `agency_managed()` and `lead_previews()` by authenticated only. `rate_limits` and `page_view_events` have RLS with no policies: service role only. `supabase/tests/access.mjs` checks all of this.
- Guide authors are admin-write only. The public reads an author only once they have a live guide, and never `authors.user_id` (column grants). Author links must be `https://`; author photos follow the upload rules below. Owners may read their own subscription, verification and daily event rollups; anon reads none of them (public pages read what they need server-side with the service role).
- Every admin mutation writes one row to `admin_actions` (ids and field names, never personal data). The log is append-only, even for admins.

## Auth

- Supabase Auth with email magic link (token-hash links via `/auth/confirm`) and Google OAuth (`/auth/google` → `/auth/callback`; the button shows only while Google is enabled in Supabase). No passwords. Only administrators sign in; no page links to /login.
- Admin routes are protected in the proxy **and** re-checked in every page and server action. A signed-in non-admin gets a 404.

## Forms & input

- The public form (contact us) has:
  - Zod validation on the server.
  - Rate limiting per IP and per email (e.g. 5 submissions/hour), stored in a `rate_limits` table or Upstash.
  - Honeypot field.
- No CAPTCHA (Cloudflare Turnstile was removed on purpose): bots are held back by the honeypot and the rate limits.
- Sign-in (magic link) is rate-limited per IP and per email (5 an hour, plus Supabase's own email limit) and has a honeypot. The response is the same whether or not the email has an account.
- Contact messages (`contact_messages`) are written only by the server action (service role, after the checks above); nobody else can read or write them, and admins handle them in Admin → Inbox. The confirmation email to the sender contains nothing they typed, so the form can't be used to send spam through us; the admin copy uses reply-to, not the sender as From.
- Never use `dangerouslySetInnerHTML` with user content.
- Guides are stored as editor JSON and sanitized on the server on every save with an allowlist (`sanitizeDoc`, lib/guide-content.ts): known nodes, marks and attributes only; links only http(s), mailto, site-relative and anchors (no `javascript:`); images only from our storage; no iframes, scripts or event handlers. The stored HTML is rendered from that clean JSON. Pasted HTML goes through `cleanPastedHtml` (drops script, iframe, object, form, styles and every attribute not on its list). Older Markdown guides are rendered server-side with rehype-sanitize. Callouts (`> [!tip]`, `[!note]`, `[!warning]`) become an `<aside>` whose class the sanitizer allows only from a fixed list (`callout`, `callout-tip`, `callout-note`, `callout-warning`); no other class or id survives from Markdown (heading ids are added after sanitizing, from the heading text).

## Image links (guide covers)

- Guide covers are links to images on our own Cloudflare host, not uploads. Only `https://` links on a host in `MEDIA_HOSTS` are accepted (checked on the server when saving); the CSP `img-src` and `next/image` allow exactly those hosts. Never widen this to arbitrary hosts.

## HTTP headers (next.config)

- `Content-Security-Policy` (allow self, Supabase, Vercel analytics).
  - `script-src` allows `'unsafe-inline'`: Next.js injects inline hydration scripts, and a nonce-based CSP would force every page to render dynamically, breaking ISR. Revisit if Next supports hashes for static pages.
  - Everything else stays strict: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and only the Supabase and Vercel origins that are needed.
- No CSP entry is needed for the site's own domain (`'self'`). Production is `https://ytagencies.com`; `www` redirects to it with a 308, so cookies and the session only ever live on the apex.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` restricting camera/mic/geolocation.

## External links

- Links to other sites in guides open in a new tab with `rel="noopener noreferrer"`; the Alternatives template adds `nofollow`. Links to the old directory's pages render as plain text.

## Privacy

- Contact messages contain personal data: collect only what's needed to answer, and support deletion on request.
- Don't log message contents or tokens.
- Publish a Privacy Policy and Terms before launch.

## Dependencies & ops

- Run `pnpm audit` before every release; enable Dependabot/Renovate.
- Enable Supabase daily backups and point-in-time recovery when on a paid plan.
- Separate Supabase projects for development and production.
