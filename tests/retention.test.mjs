// Retention cutoffs (src/lib/retention-cutoff.ts, privacy policy "How long we keep it").
import assert from "node:assert/strict";
import { test } from "node:test";

import { monthsBefore } from "../src/lib/retention-cutoff.ts";

test("24 and 12 months before a date", () => {
  const now = new Date("2026-10-12T06:00:00Z");
  assert.equal(monthsBefore(now, 24), "2024-10-12T06:00:00.000Z");
  assert.equal(monthsBefore(now, 12), "2025-10-12T06:00:00.000Z");
});

test("end of month is clamped, not rolled over", () => {
  assert.equal(monthsBefore(new Date("2026-03-31T00:00:00Z"), 1), "2026-02-28T00:00:00.000Z");
  assert.equal(monthsBefore(new Date("2025-03-31T00:00:00Z"), 13), "2024-02-29T00:00:00.000Z");
});
