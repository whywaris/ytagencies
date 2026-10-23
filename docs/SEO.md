# SEO.md

## Brand and domain

- Brand: **YT Agencies**. Production: `https://ytagencies.com` (apex, https, no www). `www.ytagencies.com` 308-redirects to the apex (`next.config.ts`).
- Brand, domain and contact email live only in `src/lib/site.ts`. Every absolute URL (canonical, `og:url`, sitemap, robots, JSON-LD, emails) is built with `absoluteUrl()` from `SITE_URL`; never hardcode a host.
- Organization JSON-LD on home: name, url, `logo` (`/logo.png`, 512×512 PNG) and email. WebSite JSON-LD: name and url.
- Not affiliated with YouTube or Google: the logo avoids play buttons and red, and the footer and emails say so.

## URL map

| Page type                               | URL                                 | Indexed?                        |
| --------------------------------------- | ----------------------------------- | ------------------------------- |
| Home                                    | `/`                                 | Yes                             |
| Service hub                             | `/youtube-ads-agencies`             | If ≥ 3 published agencies       |
| Service × industry                      | `/youtube-ads-agencies/for-doctors` | If ≥ 3 published agencies       |
| Service × location                      | `/youtube-seo-agencies/in-usa`      | If ≥ 3 published agencies       |
| Agency profile                          | `/agency/acme-media`                | Yes, if published               |
| Guide                                   | `/guides/youtube-ads-agency-cost`   | Yes                             |
| Guides index                            | `/guides`, `/guides?page=2`         | Yes (`?service=` filters: no)   |
| Author                                  | `/authors/jane-doe`                 | Yes, if they have a live guide  |
| List your agency                        | `/list-your-agency`                 | Yes                             |
| Pricing for agencies                    | `/pricing`                          | Yes                             |
| How we rank                             | `/how-we-rank`                      | Yes                             |
| About, contact                          | `/about`, `/contact`                | Yes (`/contact?topic=` canonical to `/contact`) |
| Policies                                | `/privacy`, `/terms`, `/refunds`, `/cookies`, `/disclosure`, `/editorial-policy` | Yes |
| Filters (`?budget=`, `?size=`, `?lang=`, `?contract=`) | same path + params | No; canonical to the clean path |
| Dashboard / admin / request-proposals success | —                             | No (`noindex`)                  |

## Programmatic SEO

- Combination pages are generated from DB data: `services × industries` and `services × locations`.
- **Thin-page rule:** a service hub or combination with fewer than 3 published agencies returns `robots: noindex, follow` and is left out of the sitemap. It flips to indexed automatically when it crosses the threshold.
- Each combination page must have unique content, not just a list:
  - H1: `Best YouTube Ads Agencies for Doctors` (pattern: Best {Service} for {Industry} / in {Location})
  - A 120–200 word intro written per industry (stored in `industries.intro` / `service_industry_content`).
  - Agency list with key facts (min budget, specialties, rating).
  - "How to choose" section specific to the industry.
  - 3–5 FAQs specific to the combination.
  - Related links: same service in other industries, other services for the same industry.

## Metadata (every page, via `generateMetadata`)

- Title ≤ 60 chars: `Best YouTube Ads Agencies for Doctors (2026) | YT Agencies`. Template `%s | YT Agencies`; home is `YT Agencies: Find the right YouTube agency for your business`
- Description 140–160 chars, specific, includes agency count.
- `alternates.canonical` always set to the clean absolute URL.
- Open Graph + Twitter image (generated with `next/og`).

## Structured data (JSON-LD, built in `lib/seo/`)

- All pages: `BreadcrumbList`; home: `WebSite` + `Organization`. Policy pages: `WebPage` with `dateModified`; `/about`: `AboutPage` + `Organization` (founder as `Person` once filled in); `/contact`: `ContactPage`.
- Directory pages: `ItemList` of agencies (url + position).
- Profile: `ProfessionalService` (see "Agency profiles" below), `FAQPage` from the profile's generated FAQ, `BreadcrumbList`.
- Guides: `Article` with dates and `author` as a `Person` linking to their author page. `/guides`: `CollectionPage` with an `ItemList` of the guides shown. Author pages: `Person` (name, job title, bio, photo, `sameAs` profiles).
- FAQ blocks may use `FAQPage` markup, but don't expect rich results from it.

## Technical

- `/sitemap.xml` is a sitemap index of `/sitemaps/{pages,services,combos,locations,agencies,guides,authors}.xml` (lib/sitemap.ts), with real `lastmod` (the row's `updated_at`; static pages from `lib/page-dates.ts`, none when there's no real date) and no priority/changefreq. Indexable pages only, by the same rules as the pages' robots meta (thin profiles, the 3-agency rule); never private areas or URLs with a query string. ISR hourly plus on-demand revalidation. robots.txt lists it only when `ALLOW_INDEXING` is `"true"`; then AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended) are allowed like everyone else, with private paths disallowed.
- `/llms.txt` (llmstxt.org): summary, how the directory works, and links to service pages, industries (each to its busiest indexable page), up to 30 indexable comparisons, guides and the about pages. No agency profiles. Served everywhere, linked from nowhere.
- `app/robots.ts` disallows `/dashboard`, `/admin`, `/api`, and parameterized URLs.
- One H1 per page; logical H2/H3 order.
- Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms. Use no layout shift from fonts (system stack) or images (fixed dimensions).
- Trailing slash: none. Enforce one consistent format; redirect the other.
- 404 for unknown slugs (never a soft 200).
- Pagination on large lists: `?page=2` is self-canonical and linked with normal `<a>` links.

## Agency profiles (`/agency/<slug>`)

Builders: `src/lib/profile-seo.ts` (title, description, thin rule; unit-tested), `professionalServiceJsonLd` in `src/lib/seo/json-ld.ts`, `agencyOgImage` in `src/lib/seo/og.tsx`.

- **Title** (≤ 60), unless the admin set `seo_title`: `<Name>: <Main service> Agency for <Industry> | YT Agencies` when one industry has `focus_pct` ≥ 40, otherwise `… Agency in <City> | YT Agencies` (HQ city, or country). Too long: drop ` | YT Agencies` first, then the for/in part. The name and service are never cut.
- **Description** (140–160), unless the admin set `seo_description`: `<Name> is a <City>-based YouTube <service> agency for <industry 1> and <industry 2> brands. From $<price>/<unit>, <contract>. See channels, pricing and reviews.` Missing parts are skipped. Over 160: drop the second industry, then shorten the last sentence to "See pricing and reviews.", then drop it.
- **JSON-LD `ProfessionalService`:** name, url, logo, description (the "At a glance" paragraph shown on the page), address (city, country), areaServed (locations), foundingDate, numberOfEmployees (range), priceRange (`$3,000+/month`), knowsAbout (services), sameAs (website only for managed (Pro) agencies, plus LinkedIn and the agency's YouTube channel). `aggregateRating` and `review` only from published (moderated) reviews.
- **`FAQPage`** with exactly the questions and answers shown on the page. **`BreadcrumbList`**: Home / <primary service> agencies / <name>.
- **OG image** (`/og/agency/<slug>`, 1200×630, light): logo (PNG/JPEG; otherwise initials), name, Verified badge if verified, main service · city, "From $X/<unit>", small brand.
- **Thin profiles** are `noindex,follow` and left out of `/sitemaps/agencies.xml` when they have no description and no "best for" line, OR fewer than 2 industries, OR no starting price. The agency's dashboard and Admin → Agencies → the agency say "Hidden from Google until you add: …". Every profile save revalidates the page, its OG image and the sitemap, so a fixed profile is indexable again straight away.
- Canonical is always `/agency/<slug>`; one H1 (the agency name); sitemap `lastModified` is the agency's `updated_at`.

### On-page checklist

- Unique description (min 150 words, prompt agencies on claim).
- Services and industries link to their directory pages (internal link mesh).
- Related directory pages always; "Similar agencies" on Free profiles.
- Case studies with real numbers and channel links.

## Internal linking

- Home → all service hubs + top industries.
- Service hub → all its indexed industry/location pages.
- Every profile → its service and industry pages.
- Every guide → 2–3 relevant directory pages.

## Outbound links to agency websites

- One helper builds every link to an agency's website: `agencyWebsiteLink()` in `src/lib/outbound.ts`. Don't hand-build these links.
- Only managed (Pro) agencies get a website link. Unmanaged profiles have none (and no contact form or booking buttons: they offer Request proposals instead).
- Paid links: `rel="sponsored noopener"`, `target="_blank"`. Never `noreferrer`: the site's `Referrer-Policy: strict-origin-when-cross-origin` lets the agency's analytics see ytagencies.com as the referrer.
- Every link carries `utm_source=ytagencies&utm_medium=referral&utm_campaign=directory_listing&utm_content=<profile | directory | home_hero | guide>`. The agency's own query string is kept; our `utm_*` values replace theirs, never duplicate them.
- The link has `data-track="website_click"` and `data-source=<same as utm_content>`, so the click is counted (beacon, deduped per visitor per day, bots ignored) and shown to the agency by source on its dashboard.
- Today only the profile links to agency websites.

## Off-page

- "Featured on YT Agencies" embeddable badge for every claimed agency, linking to their profile.
- Annual "YouTube agency pricing report" for PR links.

## Monitoring

- Google Search Console + Bing Webmaster Tools from day one; submit sitemaps.
- Weekly: check indexing coverage, queries at positions 8–30 (improvement targets), and crawl errors.
