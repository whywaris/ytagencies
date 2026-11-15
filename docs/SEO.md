# SEO.md

## Brand and domain

- Brand: **YT Agencies**. Production: `https://ytagencies.com` (apex, https, no www). `www.ytagencies.com` 308-redirects to the apex (`next.config.ts`).
- Brand, domain and contact email live only in `src/lib/site.ts`. Every absolute URL (canonical, `og:url`, sitemap, robots, JSON-LD, emails) is built with `absoluteUrl()` from `SITE_URL`; never hardcode a host.
- Organization JSON-LD on home: name, url, `logo` (`/logo.png`, 512×512 PNG) and email. WebSite JSON-LD: name and url.
- Not affiliated with YouTube or Google: the logo avoids play buttons and red, and the footer and emails say so.

## URL map

| Page type        | URL                                                     | Indexed?                                    |
| ---------------- | ------------------------------------------------------- | ------------------------------------------- |
| Home             | `/` (the latest guides)                                 | Yes                                         |
| Guides index     | `/guides`, `/guides?page=2`                             | Yes (`?q=` search: no, canonical `/guides`) |
| Guide            | `/guides/youtube-ads-agency-cost`                       | Yes                                         |
| Guide category   | `/guides/category/pricing`                              | From 3 live guides, else `noindex,follow`; 404 with none; old slugs 301 |
| Author           | `/authors/jane-doe`                                     | Yes, if they have a live guide              |
| About, contact   | `/about`, `/contact`                                    | Yes (`/contact?topic=` canonical to `/contact`) |
| Policies         | `/privacy`, `/terms`, `/cookies`, `/editorial-policy` | Yes                                         |
| Admin, sign-in   | `/admin/…`, `/login`, `/auth/…`                         | No (`noindex`)                              |
| The old directory | `/agency/*`, `/agencies`, `/<service>-agencies/…`, `/industries/*`, `/locations/*`, `/pricing`, `/request-proposals`, `/dashboard/*`… | **410 Gone** (`lib/removed-paths.ts`), `X-Robots-Tag: noindex` |

## Metadata (every page, via `generateMetadata`)

- Title ≤ 60 chars: `<Guide title> | YT Agencies` when it fits, else the title alone (`firstThatFits`, lib/seo/metadata.ts). Template `%s | YT Agencies`; home is `YT Agencies: YouTube guides for businesses and creators`.
- Description 140–160 chars, specific: the guide's SEO description or excerpt.
- `alternates.canonical` always set to the clean absolute URL.
- Open Graph + Twitter image (generated with `next/og`).

## Structured data (JSON-LD, built in `lib/seo/`)

- All pages: `BreadcrumbList`; home: `WebSite` + `Organization` + the guides `CollectionPage`. Policy pages: `WebPage` with `dateModified`; `/about`: `AboutPage` + `Organization`; `/contact`: `ContactPage`.
- Guides: `Article` with dates and `author` as a `Person` linking to their author page. `/guides` and `/guides/category/[slug]`: `CollectionPage` with an `ItemList` of the guides shown, plus `BreadcrumbList` (Home / Guides / Category). A guide's `BreadcrumbList` includes its category. Author pages: `Person` (name, job title, bio, photo, `sameAs` profiles).
- FAQ blocks may use `FAQPage` markup, but don't expect rich results from it.

## Technical

- `/sitemap.xml` is a sitemap index of `/sitemaps/{pages,guides,authors}.xml` (lib/sitemap.ts), with real `lastmod` (the row's `updated_at`; static pages from `lib/page-dates.ts`, none when there's no real date) and no priority/changefreq. Indexable pages only, by the same rules as the pages' robots meta (thin profiles, the 3-agency rule); never private areas or URLs with a query string. ISR hourly plus on-demand revalidation. robots.txt lists it only when `ALLOW_INDEXING` is `"true"`; then AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended) are allowed like everyone else, with private paths disallowed.
- `/llms.txt` (llmstxt.org): a summary, every live guide and the about pages.
- `app/robots.ts` disallows `/admin`, `/api`, and parameterized URLs.
- One H1 per page; logical H2/H3 order.
- Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms. Use no layout shift from fonts (system stack) or images (fixed dimensions).
- Trailing slash: none. Enforce one consistent format; redirect the other.
- 404 for unknown slugs (never a soft 200); 410 for the old directory's URLs.
- Pagination on large lists: `?page=2` is self-canonical and linked with normal `<a>` links.

## Internal linking

- Home → the latest guides; every guide → up to 3 related guides (same category first) and its category.

## Off-page

- Guides other sites want to cite: original data, clear prices with dates and sources.

## Monitoring

- Google Search Console + Bing Webmaster Tools from day one; submit sitemaps.
- Weekly: check indexing coverage, queries at positions 8–30 (improvement targets), and crawl errors.
