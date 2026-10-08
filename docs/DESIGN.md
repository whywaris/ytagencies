# DESIGN.md

## Direction

Simple, calm, professional, in the spirit of Apple's product pages. That means generous whitespace, large confident type, few colors, and nothing decorative. The content (agencies and their results) does the talking.

**The one memorable element:** the home hero. A large centred headline over a soft four-colour glow, two actions, a proof row, and a product window showing three real agencies for a real service × industry page, with service tabs. It's the only place the glow, the floating callouts and the hero tokens below are used.

## Color tokens

| Token       | Light     | Dark      | Use                                |
| ----------- | --------- | --------- | ---------------------------------- |
| `--bg`      | `#FFFFFF` | `#000000` | Page background                    |
| `--surface` | `#F5F5F7` | `#1C1C1E` | Section bands, cards               |
| `--text`    | `#1D1D1F` | `#F5F5F7` | Primary text                       |
| `--text-2`  | `#6E6E73` | `#A1A1A6` | Secondary text, meta               |
| `--line`    | `#D2D2D7` | `#38383A` | Borders, dividers                  |
| `--accent`  | `#0B57D0` | `#4C8DF6` | Links, primary buttons, focus ring |

The home hero has its own scoped tokens (`.home-hero` in globals.css): a brighter accent (`#1F5EFF` / dark `#6B9BFF`) with `accent-soft`, mint (`#12A57A` / `#3CCB9C`) and amber (`#E69A00` / `#F2B53A`) with `-soft` tints, and the glow colours. Don't use them outside the hero.

One accent only. Green `#188038` (dark mode `#34A853`) is reserved for "Verified" badges; it was `#1E8E3E`, which fails 4.5:1 contrast on white. Form errors use `--danger`: `#D70015` (dark `#FF6961`). No gradients.

## Typography

- Font stack: `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif` (SF Pro on Apple devices, Inter elsewhere, zero layout shift).
- Scale (desktop / mobile):
  - Display: 64 / 40px, weight 600, letter-spacing -0.02em
  - H1: 48 / 32px, 600, -0.015em
  - H2: 32 / 24px, 600
  - H3: 21 / 19px, 600
  - Body: 17px, 400, line-height 1.5
  - Small: 14px, `--text-2`
- Sentence case everywhere. No all-caps labels, no eyebrow text above headings.
- Line length ≤ 70 characters for paragraphs.

## Layout

- Max content width 1120px; reading pages (guides, profile about) 680px.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 80, 120px. Sections are separated by 80–120px.
- Left-aligned content, except the home hero, which is centered.
- Grid: agency results in a list (not a card grid) on desktop, one row per agency, so they're easy to compare.

```
┌──────────────────────────────────────────────────────┐
│ Logo   Services  Industries  Guides      Get matched │  sticky, frosted
├──────────────────────────────────────────────────────┤
│                                                      │
│     I need a YouTube [Ads ▾] agency for [Doctors ▾]  │
│                  [ Find agencies ]                   │
│                                                      │
│     Browse by service:  Ads · SEO · Channel mgmt ... │
├──────────────────────────────────────────────────────┤
│  Directory page                                      │
│  H1 + intro          │ Filters (budget, size, lang)  │
│  ┌ logo  Name  ✓ Verified        from $2k/mo  View ┐ │
│  │ Specialties · Rating · Location                   │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

## Components

- **Nav:** 52px tall, sticky, `backdrop-filter: blur(20px)` over a translucent `--bg`; hairline bottom border.
- **Buttons:** primary = `--accent` fill, white text, fully rounded (pill), 44px tall. Secondary = text link in `--accent`. Labels say exactly what happens ("Find agencies", "Send inquiry", "Claim this listing").
- **Agency row:** white on `--bg`, 1px `--line` border, 16px radius, no shadow. Hover: border darkens only.
- **Inputs:** 44px, 12px radius, `--surface` fill, no border until focus.
- **Badges:** small text pills: "Verified" (green), "Sponsored" (neutral outline, only on sponsored slots), "Founding agency" (neutral fill).
- Radius hierarchy: pills for buttons/badges, 16px for rows/cards, 12px for inputs, 8px for logos.

## Motion

- Only response motion: menu open, filter apply, form confirmation (150–250ms ease-out).
- No scroll-triggered fade-ins. Respect `prefers-reduced-motion`.

## Accessibility floor

- Text contrast ≥ 4.5:1; visible 2px `--accent` focus ring with offset.
- Tap targets ≥ 44px. Full keyboard navigation. Alt text for every logo ("{Agency} logo").

## Copy voice

Plain and specific. "Agencies that run YouTube ads for clinics and private practices", not "Unlock explosive growth". Empty states tell people what to do next: "No agencies match these filters yet. Try removing the budget filter."
