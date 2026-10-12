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
  responseMinutes: null,
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
      responseMinutes: 90,
    }),
    100,
  );
});

test("quality score: each part counts (the first three scaled to 90 points)", () => {
  assert.equal(qualityScore({ ...empty, descriptionLength: 60 }), 5); // 4.5
  assert.equal(qualityScore({ ...empty, descriptionLength: 250 }), 9);
  assert.equal(qualityScore({ ...empty, caseStudies: 1 }), 9);
  assert.equal(qualityScore({ ...empty, reviews: { count: 2, average: 4 } }), 14); // 13.5
  assert.equal(qualityScore({ ...empty, verification: "approved" }), 14); // 13.5
  assert.equal(qualityScore({ ...empty, verification: "withStats" }), 27);
});

test("quality score: response time is worth up to 10", () => {
  assert.equal(qualityScore({ ...empty, responseMinutes: 3 * 60 }), 10);
  assert.equal(qualityScore({ ...empty, responseMinutes: 20 * 60 }), 7);
  assert.equal(qualityScore({ ...empty, responseMinutes: 40 * 60 }), 4);
  assert.equal(qualityScore({ ...empty, responseMinutes: 72 * 60 }), 0);
  assert.equal(qualityScore({ ...empty, responseMinutes: null }), 0);
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
