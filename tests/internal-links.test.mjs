// Internal linking: the home page's daily guides (src/lib/home.ts), and every linking block only
// pointing at live, indexable pages (liveOnly + the sitemap's set, src/lib/sitemap-core.ts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { guideGroup, relatedGroup } from "../src/lib/directory.ts";
import { agencySlugsIn } from "../src/lib/guide-content.ts";
import { dailyPick, utcDay } from "../src/lib/home.ts";
import { directoryEntries, liveOnly } from "../src/lib/sitemap-core.ts";

const guides = ["a", "b", "c", "d", "e", "f", "g"];

test("daily guides: same 3 all day (UTC), a new pick on another day, no Math.random", () => {
  const day = utcDay(new Date("2026-10-23T00:00:01Z"));
  assert.equal(day, "2026-10-23");
  assert.equal(utcDay(new Date("2026-10-23T23:59:59Z")), day);
  const pick = dailyPick(guides, day, 3);
  assert.equal(pick.length, 3);
  assert.equal(new Set(pick).size, 3);
  assert.deepEqual(dailyPick(guides, day, 3), pick, "deterministic");
  const week = ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"].map((d) =>
    dailyPick(guides, d, 3).join(),
  );
  assert.ok(
    week.some((p) => p !== pick.join()),
    "changes from day to day",
  );
  assert.deepEqual(dailyPick(["only", "two"], day, 3).sort(), ["only", "two"]);
  assert.deepEqual(dailyPick([], day, 3), []);
  assert.doesNotMatch(readFileSync("src/lib/home.ts", "utf8"), /Math\.random/);
});

test("liveOnly keeps sitemap pages only; query and hash don't matter", () => {
  const live = new Set(["/youtube-ads-agencies", "/youtube-ads-agencies/for-saas", "/agency/goat"]);
  const links = [
    { href: "/youtube-ads-agencies" },
    { href: "/youtube-ads-agencies/for-saas#agencies" },
    { href: "/youtube-ads-agencies/for-dentists" }, // under 3 agencies: noindex
    { href: "/youtube-thumbnail-agencies" }, // thin hub
    { href: "/agency/thin-profile" },
  ];
  assert.deepEqual(
    liveOnly(links, live).map((l) => l.href),
    ["/youtube-ads-agencies", "/youtube-ads-agencies/for-saas#agencies"],
  );
});

test("no linking block points at a noindex page: combos come from the 3-agency index", () => {
  const pages = [
    { serviceSlug: "ads", segment: "for-saas", count: 3, lastModified: "2026-10-01" },
    { serviceSlug: "ads", segment: "for-dentists", count: 2, lastModified: "2026-10-01" },
  ];
  const live = new Set(directoryEntries(pages, 3, "for").map((e) => e.path));
  assert.deepEqual([...live], ["/ads/for-saas"]);
  // The pages build their blocks from these helpers, never from raw taxonomy lists.
  const profile = readFileSync("src/app/(marketing)/agency/[slug]/page.tsx", "utf8");
  assert.match(profile, /const listedIn = liveOnly\(/);
  const guide = readFileSync("src/app/(marketing)/guides/[slug]/page.tsx", "utf8");
  assert.match(guide, /const related = liveOnly\(g\.related, live\)/);
  assert.match(guide, /live\.has\(`\/agency\/\$\{slug\}`\)/);
  const hub = readFileSync("src/app/(marketing)/[service]/page.tsx", "utf8");
  assert.match(hub, /hubCounts\.get\(s\.slug\) \?\? 0\) >= MIN_AGENCIES_TO_INDEX/);
});

test("anchor text is descriptive: short label, full phrase as title; never 'click here'", () => {
  const g = relatedGroup("Other services", [
    {
      href: "/youtube-seo-agencies",
      label: "YouTube SEO",
      title: "YouTube SEO agencies",
      count: 4,
    },
  ]);
  assert.equal(g.links[0].title, "YouTube SEO agencies");
  for (const f of [
    "src/components/directory/directory-page.tsx",
    "src/app/(marketing)/agency/[slug]/page.tsx",
    "src/components/guides/guide-article.tsx",
  ])
    assert.doesNotMatch(readFileSync(f, "utf8"), />\s*(click here|read more|here)\s*</i, f);
});

test("guides for directory pages and agencies mentioned in a guide", () => {
  assert.equal(guideGroup([]), null);
  const two = guideGroup([
    { slug: "cost", title: "What it costs" },
    { slug: "hire", title: "How to choose" },
  ]);
  assert.equal(two.title, "Related guides");
  assert.deepEqual(
    two.links.map((l) => l.href),
    ["/guides/cost", "/guides/hire"],
  );
  const link = (href, text) => ({ type: "text", text, marks: [{ type: "link", attrs: { href } }] });
  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          link("/agency/goat-agency", "Goat"),
          link("https://ytagencies.com/agency/humble-brag?x=1", "Humble"),
          link("/agency/goat-agency", "Goat again"),
          link("https://evil.com/agency/fake", "Not ours"),
          link("/youtube-ads-agencies", "A hub"),
        ],
      },
    ],
  };
  assert.deepEqual(agencySlugsIn(doc, "ytagencies.com"), ["goat-agency", "humble-brag"]);
});
