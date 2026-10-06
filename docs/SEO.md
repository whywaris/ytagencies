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
| Service hub                             | `/youtube-ads-agencies`             | Yes                             |
| Service × industry                      | `/youtube-ads-agencies/for-doctors` | If ≥ 3 published agencies       |
| Service × location                      | `/youtube-seo-agencies/in-usa`      | If ≥ 3 published agencies       |
| Agency profile                          | `/agency/acme-media`                | Yes, if published               |
| Guide                                   | `/guides/youtube-ads-agency-cost`   | Yes                             |
| List your agency                        | `/list-your-agency`                 | Yes                             |
| Filters (`?budget=`, `?sort=`)          | same path + params                  | No; canonical to the clean path |
| Dashboard / admin / get-matched success | —                                   | No (`noindex`)                  |

## Programmatic SEO

- Combination pages are generated from DB data: `services × industries` and `services × locations`.
- **Thin-page rule:** a combination with fewer than 3 published agencies returns `robots: noindex, follow` and is left out of the sitemap. It flips to indexed automatically when it crosses the threshold.
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

- All pages: `BreadcrumbList`; home: `WebSite` + `Organization`.
- Directory pages: `ItemList` of agencies (url + position).
- Profile: `ProfessionalService` with name, url, logo, areaServed, address (if public). Add `aggregateRating` only from genuine, moderated third-party reviews.
- Guides: `Article` with author and dates.
- FAQ blocks may use `FAQPage` markup, but don't expect rich results from it.

## Technical

- `app/sitemap.ts` generates segmented sitemaps (`/sitemaps/agencies.xml`, `/sitemaps/categories.xml`, `/sitemaps/guides.xml`) with real `lastModified`.
- `app/robots.ts` disallows `/dashboard`, `/admin`, `/api`, and parameterized URLs.
- One H1 per page; logical H2/H3 order.
- Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms. Use no layout shift from fonts (system stack) or images (fixed dimensions).
- Trailing slash: none. Enforce one consistent format; redirect the other.
- 404 for unknown slugs (never a soft 200).
- Pagination on large lists: `?page=2` is self-canonical and linked with normal `<a>` links.

## On-page checklist (profiles)

- Unique description (min 150 words, prompt agencies on claim).
- Services and industries link to their directory pages (internal link mesh).
- "Similar agencies" block (4 links).
- Case studies with real numbers and channel links.

## Internal linking

- Home → all service hubs + top industries.
- Service hub → all its indexed industry/location pages.
- Every profile → its service and industry pages.
- Every guide → 2–3 relevant directory pages.

## Off-page

- "Featured on YT Agencies" embeddable badge for every claimed agency, linking to their profile.
- Annual "YouTube agency pricing report" for PR links.

## Monitoring

- Google Search Console + Bing Webmaster Tools from day one; submit sitemaps.
- Weekly: check indexing coverage, queries at positions 8–30 (improvement targets), and crawl errors.
