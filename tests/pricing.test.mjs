// Pricing details and response-time labels (src/lib/pricing.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONTRACT_FILTERS,
  adSpendLabel,
  contractLabel,
  noLockIn,
  responseLabel,
} from "../src/lib/pricing.ts";

test("contract labels", () => {
  assert.equal(contractLabel("none"), "No minimum contract");
  assert.equal(contractLabel("1_month"), "1-month minimum");
  assert.equal(contractLabel("3_months"), "3-month minimum");
  assert.equal(contractLabel("12_months"), "12-month minimum");
  assert.equal(contractLabel(null), null);
});

test("ad spend labels: hidden when not applicable or unknown", () => {
  assert.equal(adSpendLabel("separate"), "Ad spend paid separately to Google");
  assert.equal(adSpendLabel("included"), "Ad spend included");
  assert.equal(adSpendLabel("not_applicable"), null);
  assert.equal(adSpendLabel(null), null);
});

test("No lock-in: no minimum or one month only", () => {
  assert.equal(noLockIn("none"), true);
  assert.equal(noLockIn("1_month"), true);
  assert.equal(noLockIn("3_months"), false);
  assert.equal(noLockIn(null), false);
  assert.equal(CONTRACT_FILTERS["3-months"].test("3_months"), true);
  assert.equal(CONTRACT_FILTERS["3-months"].test("6_months"), false);
});

test("response labels: few hours, a day, two days, else nothing", () => {
  assert.equal(responseLabel(30), "Usually replies within a few hours");
  assert.equal(responseLabel(4 * 60 - 1), "Usually replies within a few hours");
  assert.equal(responseLabel(4 * 60), "Usually replies within a day");
  assert.equal(responseLabel(24 * 60), "Usually replies within 2 days");
  assert.equal(responseLabel(48 * 60), null);
  assert.equal(responseLabel(null), null);
});
