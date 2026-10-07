-- ADMIN_V2_SPEC §8: guides move from MDX files into the database (Guides CMS).
-- schema.sql has the same tables for fresh projects; the guide itself is also in seed.sql.

begin;

create table guides (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 1 and 200),
  excerpt text check (char_length(excerpt) <= 300),
  body_md text not null default '' check (char_length(body_md) <= 100000),
  cover_path text,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  author_name text check (char_length(author_name) <= 100),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  published_at timestamptz,
  related_combos jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or published_at is not null)
);
create index guides_live_idx on guides (published_at) where status in ('published', 'scheduled');
create trigger set_updated_at before update on guides for each row execute function set_updated_at();

-- Old slugs of guides whose URL changed ("Change URL" in the editor). /guides/<old> redirects
-- permanently to the guide's current slug.
create table guide_redirects (
  from_slug text primary key check (from_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  guide_id uuid not null references guides(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table guides enable row level security;
alter table guide_redirects enable row level security;

-- Live = published, or scheduled with its time passed. Everyone may read live guides (the
-- public pages use the anon key); drafts and future ones are admin-only.
create policy "read live guides" on guides for select
  using ((status in ('published', 'scheduled') and published_at <= now()) or is_admin());
create policy "admin write" on guides for all to authenticated using (is_admin()) with check (is_admin());
-- A redirect is only readable once its target is live, so it can't leak an unpublished slug.
create policy "read live redirects" on guide_redirects for select using (
  exists (select 1 from guides g where g.id = guide_id
          and ((g.status in ('published', 'scheduled') and g.published_at <= now()) or is_admin())));
create policy "admin write" on guide_redirects for all to authenticated using (is_admin()) with check (is_admin());

-- The first guide, moved from MDX (src/content/guides) into the CMS. Real content: keep for launch.
insert into guides (slug, title, excerpt, body_md, seo_description, author_name, status,
  published_at, related_combos, created_at, updated_at)
select 'youtube-ads-agency-cost',
  'How much does a YouTube ads agency cost?',
  'What YouTube ads agencies charge, how fees and production add up, and how to budget your first three months.',
  $md$Hiring a YouTube ads agency usually means paying for two separate things: the agency's fee for running your campaigns, and the ad spend that goes to Google. Many first quotes are confusing because they mix the two. This guide breaks down how agencies price their work, what you're actually paying for, and how to set a budget you can stick to.

{{budget-range youtube-ads-agencies}}

## Ad spend and agency fees are separate

Your **ad spend** is the money Google charges when people watch or click your ads. You pay it to Google, usually on your own card or invoice, and it scales with how many people you want to reach.

The **agency fee** pays for the people planning, building and improving your campaigns. Ask every agency to quote these separately. If a quote is one number, ask how much of it reaches Google.

## The four common pricing models

### Percentage of ad spend

The agency takes a share of what you spend on ads. For example, a 15% fee on $10,000 of monthly spend is $1,500 a month. This is simple and grows with your account, but it gives the agency a reason to recommend spending more. Most agencies that use it also set a monthly minimum.

### Flat monthly retainer

You pay the same fee each month regardless of spend. It's predictable and easy to budget. Check exactly what's included: the number of campaigns, how often they report, and whether new ad creative costs extra.

### Per video or per project

Some agencies charge for producing ad videos separately, either per finished video or per campaign launch. This is common when the agency both makes the creative and runs the ads. Ask how many versions and edits each video includes, because testing several cuts is how YouTube ads improve.

### Performance-based

The fee is tied to results, such as a price per lead or a share of revenue. It sounds safe, but read the definitions closely. Agree in writing what counts as a lead or a sale, how it's tracked, and what happens if tracking breaks.

## What drives the price up or down

- **Creative needs.** If you already have good videos, management alone costs less. If you need new ads every month, expect production costs on top.
- **Regulated industries.** Healthcare, finance, crypto and legal ads need extra policy knowledge and review time. Specialist agencies often charge more, and they're usually worth it.
- **Number of markets.** Running campaigns in several countries or languages multiplies setup and reporting work.
- **Reporting depth.** Connecting YouTube to your CRM or store so you can see booked calls or revenue, not just views, takes more setup.

## How to budget your first three months

YouTube campaigns need time to learn. The first weeks are for testing audiences and ad versions, so judge results over about three months rather than three weeks.

1. **Set a test ad budget you can afford to spend without a guaranteed return.** It should be large enough for each ad version to get a fair number of views.
2. **Add the agency fee and any production costs.** Multiply the monthly total by three.
3. **Agree on one or two numbers that matter** before you start, such as cost per booked call or return on ad spend, and review them monthly.
4. **Check the contract length.** A three-month minimum is normal. Long lock-ins before you've seen results are a warning sign.

## Questions to ask before you sign

- Which part of the quote is the agency fee, and which part is ad spend?
- Who owns the ad account and the videos if we stop working together?
- How many new ad versions will you test each month?
- Can you show results from a business like ours, with real numbers?
- What happens if the first three months don't hit the agreed numbers?

An agency that answers these clearly, in writing, is usually one that will be straightforward to work with.
$md$,
  'What YouTube ads agencies charge, how management fees, retainers and video production add up, and how to budget your first three months without overspending.',
  'YT Agencies editorial team',
  'published',
  '2026-10-04T09:00:00Z',
  jsonb_build_array(
    jsonb_build_object('service_id', (select id from services where slug = 'youtube-ads-agencies')),
    jsonb_build_object('service_id', (select id from services where slug = 'youtube-ads-agencies'),
                       'industry_id', (select id from industries where slug = 'doctors')),
    jsonb_build_object('service_id', (select id from services where slug = 'youtube-video-production-agencies'))
  ),
  '2026-10-04T09:00:00Z',
  '2026-10-04T09:00:00Z'
where exists (select 1 from services where slug = 'youtube-ads-agencies')
on conflict (slug) do nothing;

commit;
