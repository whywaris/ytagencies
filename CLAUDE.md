@AGENTS.md

# CLAUDE.md — YT Agencies

## What this is

**YT Agencies** (`https://ytagencies.com`, apex, no www). Brand name, domain and contact email live only in `src/lib/site.ts`; build absolute URLs with `absoluteUrl()`. Independent: never use YouTube's logo, play buttons or red in the brand.

A directory that helps businesses find the right YouTube agency by **service** (Ads, SEO, channel management, production, Shorts, influencer marketing) and **industry** (crypto, doctors/healthcare, dentists, real estate, SaaS, e-commerce, coaches, law…) and **location**.
Two sides: businesses search and send inquiries (free); agencies claim listings and pay for visibility and leads.

This is an SEO-first product. Every public page must be server-rendered, fast, and indexable on purpose.

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
- **Bot protection:** Cloudflare Turnstile on every public form.
- **Search:** Postgres full-text search (tsvector) for v1.
- **Hosting:** Vercel. DNS on Cloudflare in **DNS-only (grey cloud)** mode. Do not proxy Vercel through Cloudflare.
- **Analytics:** Vercel Analytics + Google Search Console.
- **Payments:** not in v1.

## Folder structure

```
src/
  app/
    (marketing)/page.tsx             # home
    [service]/page.tsx               # /youtube-ads-agencies
    [service]/[segment]/page.tsx     # /youtube-ads-agencies/for-doctors | /in-usa
    agency/[slug]/page.tsx           # agency profile
    guides/[slug]/page.tsx           # guides, from the Guides CMS (guides table, admin/guides)
    get-matched/page.tsx             # lead form
    dashboard/...                    # agency dashboard (auth required, noindex)
    admin/...                        # admin (role required, noindex)
    sitemap.ts, robots.ts
  components/ui/                     # shadcn primitives (restyled)
  components/                        # app components
  lib/supabase/{server,client,admin}.ts
  lib/seo/                           # metadata + JSON-LD builders
  lib/validation/                    # Zod schemas
  emails/                            # React Email templates
supabase/schema.sql
docs/
```

## Routing rules

- Service slugs end in `-agencies` (e.g. `youtube-seo-agencies`).
- Segment slugs: `for-<industry>` or `in-<location>`. Parse the prefix in `[segment]` and return `notFound()` for anything else.
- All slugs are lowercase kebab-case and never change after publish. If one must change, add a 301 in `next.config`. Exception: guide slugs change in the CMS with "Change URL", which records the old slug in `guide_redirects` and redirects it permanently at request time (no deploy).

## Rendering rules

- Directory, profile, and guide pages: static generation with ISR (`revalidate = 3600`), plus on-demand `revalidatePath` when an agency updates its profile.
- Dashboard/admin: dynamic, auth-gated, `noindex`.
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
