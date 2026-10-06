# ADMIN_V2_SPEC.md — Admin redesign, Guides CMS, Plans system

Read CLAUDE.md, SECURITY.md, docs/DESIGN.md and docs/SEO.md first. This spec adds to them; where it says something different for the admin area, this spec wins **inside /admin only**. The public site's design stays as it is.

Work in the phases at the end. **One phase per session.** After each phase: run lint, typecheck, build and all tests, commit, push, and stop with a short report (what changed, what to test by hand, any decisions you made).

---

## 1. Goal

A calm, dense, professional admin that feels like a serious internal tool (think Linear, Vercel, Stripe dashboards), not a template. It must not look AI-generated.

### Anti-"AI slop" rules (mandatory)
- No gradients, glows, glassmorphism on cards, colored shadows, or decorative blobs.
- No purple/lavender. One accent color only: the site's `--accent`. Status colors only for status.
- No emoji as icons. Icons: `lucide-react`, 16px, stroke 1.5, `--text-2` color by default.
- No all-caps eyebrow labels, no "A · B · C" meta strings, no "→" appended to buttons.
- Don't wrap everything in identical shadowed cards. Use hairline borders (1px `--line`), whitespace and alignment for structure. Shadows only on floating layers (menus, dialogs, popovers).
- No fake or placeholder numbers in the UI. Every number comes from the database; zero states are designed, not filled with demo data.
- No lorem ipsum. Copy is short, sentence case, plain verbs. Buttons say what happens ("Publish agency", not "Submit").
- Consistent 4/8px spacing grid, aligned columns, numbers right-aligned in tables.
- Motion only where it explains something (see §3). No fade-in-on-scroll, no hover animation on every card.

---

## 2. Typography & numbers

- Load **Inter** (variable) with `next/font/google`, scoped to the admin layout only (public site keeps the system stack). `display: swap`, subset latin.
- Enable OpenType features globally in admin: `font-feature-settings: "cv11", "ss01", "ss03";` (cleaner a/l/digits).
- **All numbers use tabular figures:** a utility class `.num { font-variant-numeric: tabular-nums lining-nums; }` applied to KPIs, table number cells, chart axes, tooltips, badges with counts and dates.
- Never use a monospace font for numbers or labels.

Type scale (admin):
| Role | Size / line-height | Weight | Tracking |
|---|---|---|---|
| Page title | 24 / 32 | 600 | -0.015em |
| Section title | 15 / 22 | 600 | -0.005em |
| KPI value | 30 / 36 | 600 | -0.02em, `.num` |
| Body / table | 14 / 20 | 400 | 0 |
| Table header | 12 / 16 | 500 | 0, `--text-2` |
| Meta / helper | 12 / 16 | 400 | `--text-2` |

Number formatting (one helper, `lib/format.ts`, using `Intl.NumberFormat`):
- Counts: `1,284`; compact above 10k: `12.4k`.
- Currency: `$1,250` (no decimals unless < $10).
- Percent deltas: `+18.2%` / `−4.1%` (real minus sign), one decimal.
- Dates: "Oct 6", with year only when not the current year; relative ("2h ago") in activity lists with the full date in a tooltip.

---

## 3. Visual system (admin)

- Reuse the color tokens from DESIGN.md (`--bg`, `--surface`, `--text`, `--text-2`, `--line`, `--accent`), plus:
  - `--surface-2` for hovered rows and the sidebar active item (a 4–6% tint of `--text`).
  - Status: success `#188038` / dark `#34A853`, warning `#B06000` / dark `#F2B33D`, danger `#C5221F` / dark `#F28B82`.
- Light and dark mode: follow system by default, with a toggle in the top bar (stored in a cookie, no flash on load).
- Radius: 8px for inputs/buttons in admin (denser than the public pills), 12px for panels, 6px for badges.
- Density: table rows 44px, sticky table header, 24px page padding, 1120–1280px max content width.

### Motion (Framer Motion or CSS; respect `prefers-reduced-motion` everywhere — disable all of it)
- **Charts:** line/area draws in once on first mount (700ms, ease-out); bars grow from baseline (500ms, 30ms stagger). Changing the period crossfades the data (200ms), it doesn't redraw from zero.
- **KPI values:** count up from 0 on first mount (600ms, ease-out), then update in place without re-animating.
- **Sidebar collapse:** width 200ms; labels fade.
- **Feedback:** toasts (sonner) for completed actions; dialogs scale 0.98→1 + fade (150ms).
- **Loading:** skeletons shaped like the final content (no spinners on page loads).

### Charts
- Library: **Recharts** via the shadcn chart wrapper.
- Colors: current period = `--accent`; previous period = `--text-2` dashed line at 60% opacity. Never more than 3 series.
- Thin gridlines (`--line` at 50%), no chart borders, axis labels 12px `.num`.
- Tooltip: crosshair line, date + value + delta vs previous period.
- Every chart has an empty state ("No leads in this period yet").
- Lazy-load chart components; admin is dynamic, but keep the JS reasonable.

---

## 4. Layout shell

```
┌───────────────┬──────────────────────────────────────────────────────┐
│ YT Agencies ◧ │ Admin / Agencies / Edit      [Search ⌘K]  ◐  🔔  (A) │
├───────────────┼──────────────────────────────────────────────────────┤
│ Overview      │                                                      │
│   Dashboard   │   Page title                         [Primary action]│
│ Directory     │                                                      │
│   Agencies    │   content                                            │
│   Submissions3│                                                      │
│   Claims     2│                                                      │
│   Reviews    1│                                                      │
│   Verification│                                                      │
│ Growth        │                                                      │
│   Leads       │                                                      │
│   SEO pages   │                                                      │
│ Revenue       │                                                      │
│   Plans       │                                                      │
│   Sponsored   │                                                      │
│ Content       │                                                      │
│   Guides      │                                                      │
│   Taxonomy    │                                                      │
│ ─────────────  │                                                      │
│ Settings      │                                                      │
│ View site ↗   │                                                      │
└───────────────┴──────────────────────────────────────────────────────┘
```

- **Sidebar:** 248px, collapsible to 64px (icons only, tooltips on hover); state saved in a cookie. Group headings in sentence case, 12px, `--text-2`. Active item: `--surface-2` background + `--text` color + 2px accent bar on the left. Count badges (pending items) right-aligned, `.num`.
- **Mobile (< 900px):** sidebar becomes a sheet opened from a menu button.
- **Top bar (56px):** breadcrumbs; ⌘K command palette (`cmdk`): jump to any page, search agencies by name/website, leads by email, guides by title, and quick actions ("New agency", "New guide"); theme toggle; notifications popover; profile menu (View site, Sign out).
- **Notifications:** computed from pending submissions/claims/reviews/verifications and new leads since the admin last opened the popover (store `last_seen_at` on the profile). No new realtime infra needed.

---

## 5. Pages

Every page has: loading skeleton, empty state with a next action, error state with retry, and correct breadcrumbs. Destructive actions always use a confirmation dialog naming the item. Every admin mutation writes to `admin_actions` (see §7).

### 5.1 Dashboard (`/admin`)
Period selector: **7 days / 30 days / 12 months** (top right). All deltas compare to the previous equal period.

- **KPI row (4, separated by hairline dividers, not 4 shadowed cards):**
  1. Leads — count in period + delta.
  2. Needs action — submissions + claims + reviews + verifications pending; links to the oldest item.
  3. Agencies — published count, with "X claimed" as meta.
  4. SEO pages — indexable combinations / total combinations.
- **Leads over time:** area chart (current vs previous period dashed).
- **Needs your attention:** list grouped by type, oldest first, each row linking to its item.
- **Supply gaps:** table of service × industry (and × location) combos ranked by leads in period ÷ published agencies. Columns: combo, leads, agencies, status (noindex/indexed). This tells the admin which agencies to recruit.
- **Recent leads:** last 8 (name, need, budget, routed to, time).
- **Top agencies:** by profile views / inquiries in period (from `agency_events`, §7).

### 5.2 Agencies (`/admin/agencies`)
- Search (name, website, slug), filter tabs with counts (All, Published, Draft, Archived) — fix the current bug where two tabs look selected; plus filter menu (Claimed, Verified, Plan, Service, Industry).
- Server-side pagination (25/page), column sorting (name, updated, leads in 30d).
- Columns: logo + name + slug, status badge, plan badge, verified badge, claimed, leads (30d, `.num`), updated.
- Checkbox selection with a bulk action bar: Publish, Unpublish, Archive (with confirmation).
- Row `⋯` menu: Edit, View live ↗, Copy link, Verify…, Change plan…, Unpublish/Archive (danger, confirm). No loud red buttons in rows.
- **Agency detail** (`/admin/agencies/[id]`) with tabs: Profile, Case studies, Plan & billing, Verification, Leads, Activity (from `admin_actions` + `agency_events`).

### 5.3 Submissions, Claims, Reviews
Queue layout: list on the left, selected item detail on the right (or a drawer on mobile). Actions: Approve/Publish, Reject (with optional reason emailed to the submitter). Keyboard: `j/k` to move, `a` approve, `r` reject (show a hint).

### 5.4 Verification (`/admin/verification`)
- Queue of agencies that requested verification, plus a "Verify" action from any agency.
- Admin pastes the agency's YouTube channel URLs; server fetches stats with the **YouTube Data API v3** (`YOUTUBE_API_KEY`, server-only): channel title, subscribers, total views, video count, published date.
- Admin confirms (with a checklist: channel ownership/management proof reviewed, website domain matches, business looks real) → `verifications.status = approved`. The badge shows only when approved.
- Re-check stats monthly (Vercel cron) and store snapshots.

### 5.5 Leads (`/admin/leads`)
Table with filters (service, industry, budget, date range), search by email/company; detail drawer shows the full inquiry and which agencies received it and when. Delete (GDPR) with confirmation. CSV export of the current filter.

### 5.6 SEO pages (`/admin/seo-pages`)
Every service × industry and service × location combination: agencies count, indexed/noindex, copy status (Complete / Missing), leads in 30d, last updated, link to edit copy and to the live page. Filter: Missing copy, Close to indexable (2 agencies), Indexed.

### 5.7 Plans & subscriptions (`/admin/plans`)
- List of agencies by plan (Free, Founding, Verified), start/end dates, source (manual, founding, payment).
- Change plan manually (e.g., grant Founding for 6 months) with end date.
- Summary: count per plan, upcoming expiries (next 30 days).

### 5.8 Sponsored slots (`/admin/sponsored`)
- Grid of pages (combos) × slots (max 3 per page): who holds each slot, start/end, status (active, scheduled, expired).
- Create/edit a slot: pick page (service × industry/location), agency (must be Verified), position, dates, price (number, for records only).
- Show which slots expire in the next 14 days.

### 5.9 Guides (`/admin/guides`) — see §8.

### 5.10 Taxonomy and Settings
Taxonomy: same functionality as today, restyled. Settings: admin profile, `PAYMENTS_ENABLED` status (read-only display of env), founding-agency settings (program open/closed, max spots, free months).

---

## 6. Plans system (build now, payments off)

### Entitlements
One server function `getEntitlements(agency)` used everywhere:

| Entitlement | Free | Founding | Verified |
|---|---|---|---|
| Case studies | 2 | Unlimited | Unlimited |
| Website link on profile | No | Yes | Yes |
| "Similar agencies" block on own profile | Shown | Hidden | Hidden |
| Get-matched priority | Normal | High | High |
| List position | Normal | Above Free | Above Free |
| Analytics history | 30 days | 12 months | 12 months |
| UTM-tagged links | No | Yes | Yes |
| Can buy Sponsored slots | No | Yes | Yes |
| Verified badge | Only if verification approved (any plan can request it; Free requests are queued behind paid ones) |

Founding = Verified-level entitlements for a limited period (default 6 months), plus a "Founding agency" badge forever. After it ends the agency drops to Free unless upgraded.

### Public site changes
- **Ranking order on directory pages:** sponsored slots (max 3, labeled "Sponsored") → Founding/Verified → Free; within each group by a quality score (profile completeness, published reviews, verified stats). Document this on **/how-we-rank** (indexable page).
- Paid/sponsored website links: `rel="sponsored noopener"`; free profiles have no outbound website link (inquiries go through the contact form).
- Get-matched routing: prefer Verified/Founding agencies that match, then Free.
- **/for-agencies/pricing** page: three plans (Free, Verified $29/mo or $249/yr, Sponsored from $49/mo per page). While `PAYMENTS_ENABLED !== "true"`, Verified shows "Free during launch — join as a Founding agency" and the CTA goes to /list-your-agency; Sponsored shows "Contact us".
- Agency dashboard: shows current plan, entitlements, and an analytics panel (profile views, website clicks, inquiries) limited to the plan's history window.

### Payments (not active)
- Create a `lib/billing/` interface (`createCheckout`, `handleWebhook`, `cancel`) with a no-op implementation. Provider (Lemon Squeezy or Paddle) will be added later. Everything gated by `PAYMENTS_ENABLED`.

---

## 7. Database changes (new migration files + update schema.sql; RLS on every table; extend access tests)

- `plans` (id: 'free' | 'founding' | 'verified', name, price_monthly, price_yearly) — seeded.
- `agency_subscriptions` (agency_id, plan_id, status: active/expired/cancelled, starts_at, ends_at, source: manual/founding/payment, external_id, created_at, updated_at). One active row per agency.
- `sponsored_slots` (id, service_id, industry_id nullable, location_id nullable, agency_id, position 1–3, starts_at, ends_at, price_usd, created_at, updated_at). Unique (page, position) for overlapping dates — enforce with an exclusion constraint or a check in the server action plus a test.
- `verifications` (id, agency_id, status: requested/approved/rejected, channels jsonb, stats_snapshot jsonb, checklist jsonb, reviewed_by, reviewed_at, created_at, updated_at).
- `agency_events` (id, agency_id, type: profile_view/website_click/contact_open/inquiry, page_path, visitor_hash, created_at) — written by a small beacon endpoint (`navigator.sendBeacon`) so pages stay static. Rate-limited, ignores bots (user-agent check), visitor_hash = salted daily hash of IP+UA (no raw IP stored). Add a daily rollup table `agency_event_daily` and prune raw events older than 90 days.
- `admin_actions` (id, admin_id, action, entity_type, entity_id, details jsonb, created_at) — audit log.
- `guides` (§8).
- `profiles.notifications_seen_at`.

RLS: all of these are admin-only for write. Agency owners can read their own subscription, verification status and event rollups. Anon can read nothing except published guides and active sponsored slot placements needed for rendering (prefer reading these server-side with the service role inside cached data functions instead of exposing tables to anon).

Update SECURITY.md with: YOUTUBE_API_KEY (server-only), PAYMENTS_ENABLED, the beacon endpoint rules, and the guides sanitization rule.

---

## 8. Guides CMS

### Data
`guides` (id, slug unique, title, excerpt, body_md, cover_path, seo_title, seo_description, author_name, status: draft/scheduled/published, published_at, related_combos jsonb [{service_id, industry_id?, location_id?}], created_at, updated_at).

### Admin
- `/admin/guides`: table with status filters (All, Draft, Scheduled, Published), search, columns: title, status, published date, updated, "View live ↗".
- `/admin/guides/new` and `/admin/guides/[id]`: two-column editor.
  - Left: title, slug (auto from title, editable until first publish, then locked; changing it later requires an explicit "Change URL" action that creates a 301), Markdown editor with a toolbar (headings, bold, italic, link, list, quote, image upload to storage, table), side-by-side live preview toggle.
  - Right panel: status + publish/schedule (date-time picker), cover image upload, excerpt (with counter), SEO title (counter, 60) and description (counter, 160) with a Google result preview, author, related directory pages (multi-select of combos), "Preview as page" link.
  - Autosave drafts every few seconds with a "Saved" indicator; warn on leaving with unsaved changes.

### Public
- `/guides` index and `/guides/[slug]` read from the database (published and `published_at <= now()`).
- Render Markdown server-side with remark/rehype + **rehype-sanitize** (no raw HTML, no scripts, links get `rel="noopener"` and external ones open in a new tab). Images through `next/image` where possible.
- On publish/update: `revalidatePath` for the guide, `/guides` and the sitemap. Scheduled guides: a Vercel cron every 15 minutes revalidates guides whose `published_at` just passed.
- Article JSON-LD, breadcrumb, OG image (cover or generated), related directory links at the end, "Updated on" date.
- Migrate the existing MDX guide into the table and remove the MDX pipeline.

---

## 9. Quality bar (check before finishing each phase)
- Keyboard: every action reachable; visible focus; ⌘K works; dialogs trap focus and close on Esc.
- Accessible contrast in both themes (≥ 4.5:1 for text).
- No layout shift when data loads (skeletons match final size).
- `prefers-reduced-motion` turns off all animation.
- Works at 375px, 768px, 1280px, 1440px.
- Admin routes stay `noindex` and role-checked in every server action.
- Take screenshots of each new page in light and dark mode and review them against §1 before reporting. Remove anything that looks templated.

---

## 10. Phases

1. **Shell & design foundation:** Inter + number utilities + format helpers, admin tokens, sidebar (collapsible, mobile sheet), top bar, breadcrumbs, ⌘K palette, theme toggle, notifications popover, skeleton/empty/error components, confirm dialog, toasts. Move existing admin pages into the new shell unchanged.
2. **Database foundations:** all migrations from §7 (except guides), RLS, access tests, `admin_actions` logging helper, `getEntitlements`, beacon endpoint + rollups.
3. **Dashboard:** KPIs with count-up, leads chart, needs attention, supply gaps, recent leads, top agencies, period selector.
4. **Directory:** agencies table + detail tabs, submissions/claims/reviews queues, verification flow with YouTube API.
5. **Growth:** leads page (filters, drawer, CSV), SEO pages health.
6. **Revenue & public plans:** plans page, sponsored slots, ranking order, /how-we-rank, /for-agencies/pricing, entitlements applied on public pages and agency dashboard, billing interface (no-op).
7. **Guides CMS:** table, editor, sanitized rendering, scheduling cron, MDX migration.
8. **Final audit:** re-run SECURITY.md and SEO.md checks, access tests, screenshots review, update docs/LAUNCH.md with new env vars (YOUTUBE_API_KEY, PAYMENTS_ENABLED, CRON_SECRET) and manual steps.
