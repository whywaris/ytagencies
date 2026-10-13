// Profile strength (src/lib/profile-strength.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { profileStrength } from "../src/lib/profile-strength.ts";

const empty = {
  hasLogo: false,
  descriptionLength: 0,
  hasBestFor: false,
  hasStartingPrice: false,
  hasContract: false,
  hasServiceFocus: false,
  hasLocation: false,
  channels: 0,
  caseStudies: 0,
};

test("nothing filled in: 0%, every item listed with what it adds", () => {
  const s = profileStrength(empty);
  assert.equal(s.percent, 0);
  assert.equal(s.items.length, 8);
  assert.equal(
    s.items.reduce((n, i) => n + i.gain, 0),
    100,
  );
});

test("everything filled in: 100%", () => {
  const s = profileStrength({
    hasLogo: true,
    descriptionLength: 250,
    hasBestFor: true,
    hasStartingPrice: true,
    hasContract: true,
    hasServiceFocus: true,
    hasLocation: true,
    channels: 2,
    caseStudies: 1,
  });
  assert.equal(s.percent, 100);
  assert.ok(s.items.every((i) => i.done));
});

test("pricing needs both price and contract; short descriptions don't count", () => {
  const s = profileStrength({ ...empty, hasStartingPrice: true, descriptionLength: 120 });
  assert.equal(s.percent, 0);
});

test("done items come first, then missing ones by gain", () => {
  const s = profileStrength({ ...empty, hasLogo: true });
  assert.equal(s.percent, 10);
  assert.equal(s.items[0].key, "logo");
  assert.ok(s.items.slice(1).every((i, k, a) => !i.done && (k === 0 || a[k - 1].gain >= i.gain)));
});
