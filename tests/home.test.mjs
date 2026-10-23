// Home page rules (src/lib/home.ts): finder target, popular combos, agency selection and the
// hide-if-empty rules.
import assert from "node:assert/strict";
import { test } from "node:test";

import { finderHref, pickHomeAgencies, popularIndustryCombos } from "../src/lib/home.ts";

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

const ag = (id, isVerified = false, quality = 0) => ({ id, name: id, isVerified, quality });

test("agencies: one sponsored first, then views, then merit (verified, score, name)", () => {
  const list = [
    ag("plain", false, 50),
    ag("ver", true, 10),
    ag("viewed"),
    ag("s1", true),
    ag("s2", true, 5),
  ];
  const picked = pickHomeAgencies(list, {
    sponsoredIds: ["missing", "s1", "s2"],
    views: { viewed: 40 },
  });
  assert.deepEqual(
    picked.map((a) => [a.id, a.sponsored]),
    [
      ["s1", true],
      ["viewed", false],
      ["ver", false],
      ["s2", false],
      ["plain", false],
    ],
  );
});

test("agencies: max 6", () => {
  const list = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ag(id));
  assert.equal(pickHomeAgencies(list, { sponsoredIds: [], views: {} }).length, 6);
});

test("agencies: fewer than 3 hides the section", () => {
  const opts = { sponsoredIds: [], views: {} };
  assert.deepEqual(pickHomeAgencies([ag("a"), ag("b")], opts), []);
  assert.equal(pickHomeAgencies([ag("a"), ag("b"), ag("c")], opts).length, 3);
});
