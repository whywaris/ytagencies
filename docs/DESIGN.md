# DESIGN.md

## Direction

Simple, calm, professional, in the spirit of Apple's product pages. That means generous whitespace, large confident type, few colors, and nothing decorative. The content (agencies and their results) does the talking.

**The one memorable element:** the home hero. A large centred headline over a soft four-colour glow, two actions, a proof row, and a product window showing three real agencies for a real service × industry page, with service tabs. It's the only place the glow and the floating callouts are used.

## Color tokens

Public site only. The admin keeps its own design (its original tokens, Inter, no tile colours): see `docs/ADMIN_V2_SPEC.md` and the `[data-admin]` block in globals.css.

| Token                      | Light      | Dark       | Use                                                      |
| -------------------------- | ---------- | ---------- | -------------------------------------------------------- |
| `--bg`                     | `#FBFBFD`  | `#0B0C10`  | Page background                                          |
| `--raised`                 | `#FFFFFF`  | `#15161B`  | Cards, windows, round icon buttons                       |
| `--surface`                | `#F3F4F7`  | `#1C1E24`  | Section bands, inputs, tracks                            |
| `--text`                   | `#16171A`  | `#F3F4F6`  | Primary text                                             |
| `--text-2`                 | `#5E626B`  | `#A0A4AD`  | Secondary text, meta                                     |
| `--line`                   | `#E2E3E8`  | `#2A2D35`  | Borders, dividers                                        |
| `--line-2`                 | `#EEEFF2`  | `#20222A`  | Faint dividers inside cards                              |
| `--accent`                 | `#1F5EFF`  | `#6B9BFF`  | Buttons, links, focus ring                               |
| accent-ink (`--on-accent`) | `#FFFFFF`  | `#071026`  | Text on an accent fill                                   |
| `--accent-soft`            | `#EAF0FF`  | `#17213A`  | Soft accent tiles                                        |
| `--accent-hover`           | `#1C55E6`  | accent 90% | Primary button hover (darker in light, keeps 4.5:1)      |
| `--accent-on-soft`         | `#1C5AF5`  | `#6B9BFF`  | Accent text on `--accent-soft` (`#1F5EFF` is 4.49:1 there) |

Tile colours, each with a `-soft` background (colour / soft):

| Token      | Light                 | Dark                  |
| ---------- | --------------------- | --------------------- |
| `--violet` | `#7C5CFF` / `#F0ECFF` | `#A28BFF` / `#221B3D` |
| `--coral`  | `#D1462A` / `#FFEFEA` | `#FF8A6E` / `#3A1E17` |
| `--mint`   | `#0B7A5A` / `#E5F7F0` | `#3CCB9C` / `#11302A` |
| `--amber`  | `#B26F00` / `#FFF5E0` | `#F2B53A` / `#33270E` |
| `--pink`   | `#C8326A` / `#FDEAF1` | `#FF7AA5` / `#3A1626` |

**Accent is the only colour for buttons, links and focus rings** across the public site, nav included. Violet, coral, mint, amber and pink are only for icon tiles, small badges and soft tile backgrounds, never for body text or buttons. Text on a soft tile must pass 4.5:1: in light mode mint passes (4.8:1) but violet, coral, pink and amber don't, so use those for icons there, or darken the colour (never the background) before putting text on them.

Green `#188038` (dark `#34A853`) is reserved for "Verified" badges. Form errors use `--danger`: `#D70015` (dark `#FF6961`). The only gradient is the home hero glow.

### Theme

Light is the default for everyone, whatever the OS or browser says. Dark only after the visitor clicks the nav toggle (moon in light, sun in dark). The choice is saved in localStorage `yta-theme` and applied by an inline script in `<head>` that sets `data-site-theme="dark"` on `<html>` before paint. No cookies, so public pages stay static. Never use `prefers-color-scheme` on the public site; use the `site-dark:` variant.

## Typography

- Font: Instrument Sans (next/font, variable, latin), fallback `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. The admin uses Inter.
- Headings: `font-stretch: 90%`, tight tracking (-0.03em to -0.04em at large sizes).
- Scale (desktop / mobile):
  - Display: 64 / 40px, weight 600, -0.04em
  - H1: 48 / 32px, 600, -0.035em
  - H2: 32 / 24px, 600, -0.03em
  - H3: 21 / 19px, 600, -0.02em
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

- **Nav:** 52px tall, sticky, `backdrop-filter: blur(20px)` over a translucent `--bg`; hairline bottom border. A 38px round theme toggle (`--raised`, 1px `--line` border) sits just before "Sign in", and in the mobile menu.
- **Buttons:** primary = `--accent` fill, accent-ink text, `--accent-hover` on hover, fully rounded (pill), 44px tall. Secondary = text link in `--accent`. Labels say exactly what happens ("Find agencies", "Send inquiry", "Claim this listing").
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
