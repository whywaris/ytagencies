@AGENTS.md

# CLAUDE.md — YT Agencies

## What this is

**YT Agencies** (`https://ytagencies.com`, apex, no www). Brand name, domain and contact email live only in `src/lib/site.ts`; build absolute URLs with `absoluteUrl()`. Company facts (legal name, location, jurisdiction, inboxes, response times, founder) live only in `src/lib/company.ts`: never invent them; `null` is a TODO that pages hide and `pnpm build` lists. Independent: never use YouTube's logo, play buttons or red in the brand.

A blog of practical guides on YouTube for businesses and creators: ads, SEO, Shorts, channel growth and what it costs to get help. Guides are written in the admin CMS (Admin → Guides). Some pages may show Google AdSense ads (`lib/ads.ts`).

Until November 2026 the site was a directory of YouTube agencies with a paid Pro plan. That code is gone (git tag `saas-final` has it); its URLs answer **410 Gone** (`lib/removed-paths.ts`), and the database tables are still there, unused.

This is an SEO-first site. Every public page must be server-rendered, fast, and indexable on purpose.

## Read before working

- `docs/DESIGN.md`: design system. Follow it exactly; don't invent new colors, radii, or shadows.
- `docs/SEO.md`: URL rules, indexing rules, schema, metadata. Every new route must comply.
- `SECURITY.md`: non-negotiable. Check it before touching auth, forms, DB, or env vars.
- `supabase/schema.sql`: source of truth for the data model.

## Stack

- **Language:** TypeScript (strict mode). No `any` unless justified in a comment.
- **Framework:** Next.js (latest stable, App Router, React Server Components by default).
- **Styling:** Tailwind CSS + shadcn/ui (Radix primitives) restyled to `docs/DESIGN.md` tokens.
- **Database/Auth/Storage:** Supabase (Postgres + Row Level Security + Auth + Storage).
- **Email:** Resend + React Email templates.
- **Forms:** react-hook-form + Zod; server actions for mutations.
- **Bot protection:** honeypot + rate limits on every public form (no CAPTCHA).
- **Search:** Postgres full-text search (tsvector) for v1.
- **Hosting:** Vercel. DNS on Cloudflare in **DNS-only (grey cloud)** mode. Do not proxy Vercel through Cloudflare.
- **Analytics:** Vercel Analytics + Google Search Console.
- **Payments:** not in v1.

## Folder structure

```
src/
  app/
    (marketing)/page.tsx             # home: the latest guides
    guides/page.tsx                  # all guides, search, paging
    guides/[slug]/page.tsx           # a guide, from the Guides CMS (guides table, admin/guides)
    guides/category/[slug]/page.tsx  # a guide category
    authors/[slug]/page.tsx          # guide authors (authors table, admin/authors)
    about, contact, privacy, terms, cookies, editorial-policy
    admin/...                        # guides, categories, authors, inbox, settings (role required, noindex)
    (auth)/login, auth/...           # admin sign-in only
    api/cron/guides                  # daily: scheduled guides, sitemap, retention purge
    sitemap.xml, sitemaps/[file], robots.ts, llms.txt
  proxy.ts                           # 410 for the old directory, 404 for unknown guides, admin gate
  components/ui/                     # shadcn primitives (restyled)
  components/                        # app components
  lib/supabase/{server,client,admin}.ts
  lib/seo/                           # metadata + JSON-LD builders
  lib/validation/                    # Zod schemas
  emails/                            # React Email templates (contact form)
supabase/schema.sql
docs/
```

## Routing rules

- Public routes: `/`, `/guides`, `/guides/<slug>`, `/guides/category/<slug>`, `/authors/<slug>` and the site pages. Anything from the old directory (`/agency/*`, `/agencies`, `/<service>-agencies/…`, `/industries/*`, `/locations/*`, `/pricing`, `/dashboard`, …) answers 410 from the proxy; add to `lib/removed-paths.ts` if another one turns up. Guide bodies never link to them (links to removed pages render as plain text).
- All slugs are lowercase kebab-case. Guide slugs change in the CMS with "Change URL", which records the old slug in `guide_redirects` and redirects it permanently at request time (no deploy). Author slugs can be edited in Admin → Authors; the old `/authors` URL then returns 404, so don't rename a live author casually.

## Rendering rules

- Home, guides, categories, authors and site pages: static with ISR (`revalidate = 3600`), plus on-demand `revalidatePath` from the Guides CMS. A cache a page reads (`unstable_cache`) must not be shorter than the page's `revalidate`: it silently lowers it.
- Admin: dynamic, auth-gated, `noindex`.
- No client-side data fetching for indexable content.

## Coding conventions

- Server Components by default; add `"use client"` only for interactivity.
- Validate every input with Zod on the server, even if validated on the client.
- DB access only through `lib/supabase/*`. The service-role client (`admin.ts`) is server-only and only for admin/cron jobs.
- Use `next/image` for all images with explicit width/height.
- Small components, named exports, no barrel files.
- Copy: sentence case, plain verbs, no filler.

## Definition of done (every PR)

- `pnpm lint && pnpm typecheck && pnpm build` pass.
- New public route has: metadata, canonical, JSON-LD, breadcrumb, and a sitemap entry (if indexable).
- Lighthouse mobile: Performance ≥ 90, SEO = 100, Accessibility ≥ 95.
- Works in light and dark mode, at 375px width, and by keyboard only.

## Commands

```
pnpm dev | pnpm build | pnpm lint | pnpm typecheck
supabase db push            # apply schema
```
