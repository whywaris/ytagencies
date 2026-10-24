// Directory ranking (src/lib/ranking.ts, ADMIN_V2_SPEC §6, /how-we-rank).
import assert from "node:assert/strict";
import { test } from "node:test";

import { qualityScore, rankAgencies, rankGroup, sponsoredEnabled } from "../src/lib/ranking.ts";

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

test("quality score: each part counts (no reply data: the 90 points scaled to 100)", () => {
  assert.equal(qualityScore({ ...empty, descriptionLength: 60 }), 5); // 4.5 → 5
  assert.equal(qualityScore({ ...empty, descriptionLength: 250 }), 10); // 9 → 10
  assert.equal(qualityScore({ ...empty, caseStudies: 1 }), 10);
  assert.equal(qualityScore({ ...empty, reviews: { count: 2, average: 4 } }), 15); // 13.5 → 15
  assert.equal(qualityScore({ ...empty, verification: "approved" }), 15);
  assert.equal(qualityScore({ ...empty, verification: "withStats" }), 30); // 27 → 30
});

test("quality score: response time is worth up to 10 when there's data", () => {
  // A full 90-point profile: base 90 + response points.
  const full = {
    hasLogo: true,
    hasTagline: true,
    descriptionLength: 400,
    hasMinBudget: true,
    caseStudies: 3,
    locations: 2,
    reviews: { count: 12, average: 5 },
    verification: "withStats",
  };
  assert.equal(qualityScore({ ...full, responseMinutes: 3 * 60 }), 100);
  assert.equal(qualityScore({ ...full, responseMinutes: 20 * 60 }), 97);
  assert.equal(qualityScore({ ...full, responseMinutes: 40 * 60 }), 94);
  assert.equal(qualityScore({ ...full, responseMinutes: 72 * 60 }), 90);
});

test("quality score: without reply data the other 90 points are scaled to 100", () => {
  assert.equal(qualityScore({ ...empty, verification: "withStats" }), 30); // 27 × 100/90
  assert.equal(qualityScore({ ...empty, caseStudies: 1 }), 10); // 9 × 100/90
  assert.equal(qualityScore({ ...empty, descriptionLength: 60 }), 5); // 4.5 × 100/90 = 5
  // Same profile: no data ↔ fastest replies both reach the top.
  assert.equal(qualityScore({ ...empty, verification: "withStats", responseMinutes: 60 }), 37);
});

const a = (id, isVerified, quality, name = id) => ({
  id,
  name,
  isVerified,
  quality,
  managed: false,
});

const mixed = [
  { ...a("free-hi", false, 90), managed: false },
  { ...a("pro-lo", false, 10), managed: true },
  { ...a("ver-lo", true, 20), managed: false },
  { ...a("ver-pro", true, 60), managed: true },
  { ...a("spon", false, 1), managed: true },
];

test("order: Verified + Pro, Pro, Verified, everyone else; each by quality then name", () => {
  const ranked = rankAgencies(mixed, [], false);
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["ver-pro", "pro-lo", "spon", "ver-lo", "free-hi"],
  );
  assert.deepEqual(
    ranked.map((r) => rankGroup(r)),
    [0, 1, 1, 2, 3],
  );
});

test("the four groups, whatever the scores", () => {
  const ranked = rankAgencies(
    [
      { ...a("rest", false, 100), managed: false },
      { ...a("verified", true, 99), managed: false },
      { ...a("pro", false, 1), managed: true },
      { ...a("both", true, 0), managed: true },
    ],
    [],
  );
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["both", "pro", "verified", "rest"],
  );
});

test("Sponsored off (the default): slot holders get no group and no label", () => {
  assert.equal(sponsoredEnabled({}), false);
  assert.equal(sponsoredEnabled({ SPONSORED_ENABLED: "false" }), false);
  assert.equal(sponsoredEnabled({ SPONSORED_ENABLED: "1" }), false);
  assert.equal(sponsoredEnabled({ SPONSORED_ENABLED: " true " }), true);
  const ranked = rankAgencies(mixed, ["spon"], false);
  assert.ok(ranked.every((r) => !r.sponsored));
  // Just a Pro agency in its group, behind the better-scored one.
  assert.equal(ranked[2].id, "spon");
  // And the default reads SPONSORED_ENABLED, which tests don't set.
  assert.ok(rankAgencies(mixed, ["spon"]).every((r) => !r.sponsored));
});

test("Sponsored on: slot holders first, then the four groups", () => {
  const ranked = rankAgencies(mixed, ["spon"], true);
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["spon", "ver-pro", "pro-lo", "ver-lo", "free-hi"],
  );
  assert.deepEqual(
    ranked.map((r) => r.sponsored),
    [true, false, false, false, false],
  );
});

test("Pro comes before free: a thin Pro profile is shown before a complete free one", () => {
  const free = {
    ...empty,
    hasLogo: true,
    hasTagline: true,
    descriptionLength: 300,
    hasMinBudget: true,
    caseStudies: 2,
    locations: 1,
  };
  const pro = { ...empty, hasLogo: true, responseMinutes: 60 };
  const ranked = rankAgencies(
    [
      { ...a("pro", false, qualityScore(pro)), managed: true },
      { ...a("free", false, qualityScore(free)), managed: false },
    ],
    [],
  );
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["pro", "free"],
  );
});

test("on the same plan, verified always above unverified, whatever the scores", () => {
  const ranked = rankAgencies([a("top", false, 100), a("low", true, 1)], []);
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["low", "top"],
  );
});

test("Sponsored on: max 3, position order, holders not on the page are skipped, no duplicates", () => {
  const items = ["a", "b", "c", "d", "e"].map((id) => a(id, false, 0));
  const ranked = rankAgencies(items, ["d", "x", "b", "d", "a", "c"], true);
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
