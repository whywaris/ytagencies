// Get matched routing (src/lib/match.ts): Pro agencies offering the service in the industry,
// budget fit first, then Verified, quality score and name; at most 3.
import assert from "node:assert/strict";
import { test } from "node:test";

import { pickMatches } from "../src/lib/match.ts";

const agency = (name, extra = {}) => ({
  id: name,
  name,
  managed: true,
  inIndustry: true,
  minBudgetUsd: null,
  isVerified: false,
  quality: 50,
  ...extra,
});

test("unmanaged agencies never receive a request, however well they match", () => {
  const picked = pickMatches(
    [agency("Unmanaged perfect fit", { managed: false, isVerified: true }), agency("Managed")],
    5000,
  );
  assert.deepEqual(
    picked.map((a) => a.name),
    ["Managed"],
  );
});

test("the industry must match: no agency outside it is sent the request", () => {
  assert.deepEqual(pickMatches([agency("Other industry", { inIndustry: false })], 5000), []);
});

test("no match: nothing routed (the lead is saved and the admin follows up)", () => {
  assert.deepEqual(pickMatches([], 5000), []);
  assert.deepEqual(pickMatches([agency("A", { managed: false })], 5000), []);
});

test("budget fit comes first; then verified, quality score, name", () => {
  const picked = pickMatches(
    [
      agency("Over budget, verified", { minBudgetUsd: 9000, isVerified: true, quality: 99 }),
      agency("Fits, low score", { minBudgetUsd: 2000, quality: 10 }),
      agency("Fits, verified", { minBudgetUsd: 3000, isVerified: true, quality: 20 }),
      agency("No minimum, high score", { quality: 90 }),
    ],
    3000,
  );
  assert.deepEqual(
    picked.map((a) => a.name),
    ["Fits, verified", "No minimum, high score", "Fits, low score"],
  );
});

test("over-budget agencies still fill the list when too few fit", () => {
  const picked = pickMatches(
    [agency("Fits", { minBudgetUsd: 500 }), agency("Over", { minBudgetUsd: 20000 })],
    1000,
  );
  assert.deepEqual(
    picked.map((a) => a.name),
    ["Fits", "Over"],
  );
});

test('"Not sure yet" skips the budget: merit order only', () => {
  const picked = pickMatches(
    [agency("Pricey, verified", { minBudgetUsd: 50000, isVerified: true }), agency("Cheap")],
    Infinity,
  );
  assert.deepEqual(
    picked.map((a) => a.name),
    ["Pricey, verified", "Cheap"],
  );
});

test("at most 3; ties break alphabetically", () => {
  const picked = pickMatches(
    ["Delta", "Bravo", "Alpha", "Charlie"].map((n) => agency(n)),
    5000,
  );
  assert.deepEqual(
    picked.map((a) => a.name),
    ["Alpha", "Bravo", "Charlie"],
  );
});
