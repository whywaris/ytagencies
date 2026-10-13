// Get matched routing (src/lib/match.ts): only managed agencies receive requests.
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
  ...extra,
});

test("unmanaged agencies never receive a request, however well they match", () => {
  const picked = pickMatches(
    [
      agency("Unmanaged perfect fit", { managed: false, isVerified: true }),
      agency("Managed", { inIndustry: false }),
    ],
    5000,
  );
  assert.deepEqual(
    picked.map((a) => a.name),
    ["Managed"],
  );
});

test("no managed agency: nothing routed (the admin follows up by hand)", () => {
  assert.deepEqual(pickMatches([agency("A", { managed: false })], 5000), []);
});

test("order: industry, budget fits, verified, then name; at most 3", () => {
  const picked = pickMatches(
    [
      agency("Zed verified", { isVerified: true }),
      agency("Over budget", { minBudgetUsd: 9000 }),
      agency("Other industry", { inIndustry: false }),
      agency("Alpha"),
      agency("Beta"),
    ],
    5000,
  );
  assert.deepEqual(
    picked.map((a) => a.name),
    ["Zed verified", "Alpha", "Beta"],
  );
});
