// Directory ranking (src/lib/ranking.ts, ADMIN_V2_SPEC §6, /how-we-rank).
import assert from "node:assert/strict";
import { test } from "node:test";

import { qualityScore, rankAgencies } from "../src/lib/ranking.ts";

const empty = {
  hasLogo: false,
  hasTagline: false,
  descriptionLength: 0,
  hasMinBudget: false,
  caseStudies: 0,
  locations: 0,
  reviews: null,
  verification: "none",
};

test("quality score: 0 for an empty profile, 100 for a complete, reviewed, checked one", () => {
  assert.equal(qualityScore(empty), 0);
  assert.equal(
    qualityScore({
      hasLogo: true,
      hasTagline: true,
      descriptionLength: 400,
      hasMinBudget: true,
      caseStudies: 3,
      locations: 2,
      reviews: { count: 12, average: 5 },
      verification: "withStats",
    }),
    100,
  );
});

test("quality score: each part counts", () => {
  assert.equal(qualityScore({ ...empty, descriptionLength: 60 }), 5);
  assert.equal(qualityScore({ ...empty, descriptionLength: 250 }), 10);
  assert.equal(qualityScore({ ...empty, caseStudies: 1 }), 10);
  assert.equal(qualityScore({ ...empty, reviews: { count: 2, average: 4 } }), 15);
  assert.equal(qualityScore({ ...empty, verification: "approved" }), 15);
  assert.equal(qualityScore({ ...empty, verification: "withStats" }), 30);
});

const a = (id, paid, quality, name = id) => ({ id, name, paid, quality });

test("order: sponsored by position, then paid, then free, each by quality then name", () => {
  const items = [
    a("free-hi", false, 90),
    a("paid-lo", true, 10),
    a("paid-hi", true, 80),
    a("free-lo", false, 5),
    a("spon", false, 1),
  ];
  const ranked = rankAgencies(items, ["spon"]);
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["spon", "paid-hi", "paid-lo", "free-hi", "free-lo"],
  );
  assert.deepEqual(
    ranked.map((r) => r.sponsored),
    [true, false, false, false, false],
  );
});

test("sponsored: max 3, position order, holders not on the page are skipped, no duplicates", () => {
  const items = ["a", "b", "c", "d", "e"].map((id) => a(id, false, 0));
  const ranked = rankAgencies(items, ["d", "x", "b", "d", "a", "c"]);
  assert.deepEqual(
    ranked.slice(0, 3).map((r) => r.id),
    ["d", "b", "a"],
  );
  assert.equal(ranked.filter((r) => r.sponsored).length, 3);
  assert.equal(ranked.length, 5);
});

test("ties break alphabetically so ranking is stable", () => {
  const ranked = rankAgencies([a("2", true, 50, "Beta"), a("1", true, 50, "Alpha")], []);
  assert.deepEqual(
    ranked.map((r) => r.name),
    ["Alpha", "Beta"],
  );
});
