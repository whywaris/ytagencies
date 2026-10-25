// Home page rules (src/lib/home.ts): finder target, popular combos, agency selection and the
// hide-if-empty rules.
import assert from "node:assert/strict";
import { test } from "node:test";

import { readFileSync } from "node:fs";

import {
  finderHref,
  guideLayout,
  industryTiles,
  pickHomeAgencies,
  popularIndustryCombos,
  statsLine,
  typicalStart,
} from "../src/lib/home.ts";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("finder: live page, else service page filtered, else Request proposals prefilled", () => {
  const counts = { "youtube-ads-agencies|for-saas": 4, "youtube-ads-agencies|for-law": 1 };
  assert.equal(
    finderHref("youtube-ads-agencies", "saas", counts, 3),
    "/youtube-ads-agencies/for-saas",
  );
  assert.equal(
    finderHref("youtube-ads-agencies", "law", counts, 3),
    "/youtube-ads-agencies?industry=law",
  );
  assert.equal(
    finderHref("youtube-ads-agencies", "crypto", counts, 3),
    "/request-proposals?service=youtube-ads-agencies&industry=crypto&ref=home",
  );
});

test("popular combos: industry pages only, most agencies first; none when no live combos", () => {
  const combos = [
    { serviceSlug: "a", segment: "for-x", count: 3 },
    { serviceSlug: "a", segment: "in-usa", count: 9 },
    { serviceSlug: "b", segment: "for-y", count: 7 },
    { serviceSlug: "a", segment: "for-z", count: 5 },
  ];
  assert.deepEqual(
    popularIndustryCombos(combos, 4).map((c) => c.segment),
    ["for-y", "for-z", "for-x"],
  );
  assert.deepEqual(
    popularIndustryCombos(combos, 3, "a").map((c) => c.segment),
    ["for-z", "for-x"],
  );
  assert.deepEqual(popularIndustryCombos([], 4), []);
});

const ag = (id, isVerified = false, quality = 0, managed = false) => ({
  id,
  name: id,
  isVerified,
  managed,
  quality,
});

test("agencies: one sponsored first, then the ranking groups, then views, score, name", () => {
  const list = [
    ag("plain", false, 50),
    ag("ver", true, 10),
    ag("viewed"),
    ag("s1", true),
    ag("s2", true, 5),
    ag("pro", false, 0, true),
  ];
  const picked = pickHomeAgencies(list, {
    sponsoredIds: ["missing", "s1", "s2"],
    views: { viewed: 40 },
  });
  assert.deepEqual(
    picked.map((a) => [a.id, a.sponsored]),
    [
      ["s1", true],
      ["pro", false],
      ["ver", false],
      ["s2", false],
      ["viewed", false],
      ["plain", false],
    ],
  );
});

test("home picks use the same groups as lib/ranking.ts (once 3+ are Verified)", async () => {
  const { rankGroup } = await import("../src/lib/ranking.ts");
  const verified = ["v1", "v2", "v3"].map((id) => ag(id, true));
  for (const managed of [true, false])
    for (const isVerified of [true, false]) {
      const first = pickHomeAgencies([ag("x", isVerified, 0, managed), ...verified], {
        sponsoredIds: [],
        views: { x: 99 },
      });
      const expectFirst = rankGroup({ managed, isVerified }) < 3 ? "x" : "v1";
      assert.equal(first[0].id, expectFirst);
    }
});

test("agencies: never empty; fewer than 3 Verified shows the most complete profiles", () => {
  const opts = { sponsoredIds: [], views: {} };
  // No Verified agencies at all (the live directory today), none indexable.
  const list = [
    { ...ag("thin", false, 90), complete: false, indexable: false },
    { ...ag("full-low", false, 20), complete: true, indexable: false },
    { ...ag("full-high", false, 70), complete: true, indexable: false },
    { ...ag("one-verified", true, 10), complete: true, indexable: false },
  ];
  assert.deepEqual(
    pickHomeAgencies(list, opts).map((a) => a.id),
    ["full-high", "full-low", "one-verified"],
  );
  // Too few complete profiles: topped up by quality score.
  assert.deepEqual(
    pickHomeAgencies([{ ...ag("a", false, 5), complete: true }, ag("b", false, 50), ag("c", false, 1)], opts).map((a) => a.id),
    ["a", "b", "c"],
  );
  // 3 or 6 cards.
  const many = (n) => Array.from({ length: n }, (_, i) => ag(`a${i}`));
  assert.equal(pickHomeAgencies(many(2), opts).length, 2);
  assert.equal(pickHomeAgencies(many(5), opts).length, 3);
  assert.equal(pickHomeAgencies(many(7), opts).length, 6);
  assert.equal(pickHomeAgencies([], opts).length, 0);
});

test("industries: only hubs with 3+ agencies; fewer than 4 hides the section", () => {
  const ind = ["saas", "crypto", "doctors", "law", "gaming"].map((slug) => ({ slug }));
  const counts = new Map([["saas", 9], ["crypto", 3], ["doctors", 5], ["law", 2], ["gaming", 4]]);
  assert.deepEqual(industryTiles(ind, counts, 3).map((i) => i.slug), ["saas", "doctors", "gaming", "crypto"]);
  assert.deepEqual(industryTiles(ind, new Map([["saas", 9], ["crypto", 3], ["doctors", 5]]), 3), []);
  assert.deepEqual(industryTiles(ind, new Map([["saas", 9]]), 3), []);
});

test("guides: one wide card, two columns, or a grid of three", () => {
  assert.equal(guideLayout(1), "featured");
  assert.equal(guideLayout(2), "two");
  assert.equal(guideLayout(3), "three");
  const src = read("src/components/home/sections.tsx");
  assert.match(src, /layout === "featured" \? \(\n\s+<FeaturedGuide/);
  assert.match(src, /layout === "three" && "min-\[1000px\]:grid-cols-3"/);
});

test("stats line: live counts, agencies rounded down to 10s", () => {
  assert.equal(
    statsLine({ agencies: 944, services: 10, countries: 31 }),
    "940+ YouTube agencies · 10 services · 31 countries · Free for businesses",
  );
  assert.equal(statsLine({ agencies: 7, services: 1, countries: 1 }), "7 YouTube agencies · 1 service · 1 country · Free for businesses");
  assert.equal(statsLine({ agencies: 12, services: 10, countries: 0 }), "10+ YouTube agencies · 10 services · Free for businesses");
  // Counted from the published agencies in the database, not typed in.
  const data = read("src/lib/data/home.ts");
  assert.match(data, /return \{ agencies: rows\.length, services: services\.length, countries: countries\.size \};/);
  assert.match(read("src/components/home/sections.tsx"), /\{statsLine\(stats\)\}/);
});

test("typical start: only with 5+ prices in one pricing model, the median", () => {
  const p = (usd, model = "retainer") => ({ usd, model });
  assert.equal(typicalStart([p(1000), p(2000), p(3000), p(4000)]), null);
  assert.equal(typicalStart([p(1000), p(2000), p(3000), p(4000), p(null), p(500, null)]), null);
  assert.deepEqual(typicalStart([p(1000), p(2000), p(3000), p(4000), p(9000)]), { usd: 3000, model: "retainer" });
  assert.deepEqual(typicalStart([p(1000), p(2000), p(3000), p(4000), p(5000), p(6000)]), { usd: 3500, model: "retainer" });
  // Mixed units don't share a median: 3 monthly + 3 per video isn't enough of either.
  assert.equal(typicalStart([p(1), p(2), p(3), p(4, "per_video"), p(5, "per_video"), p(6, "per_video")]), null);
});
