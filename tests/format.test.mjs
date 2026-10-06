// Admin number and date formatting (src/lib/format.ts, ADMIN_V2_SPEC §2).
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatCount,
  formatCurrency,
  formatDate,
  formatDelta,
  formatRelative,
} from "../src/lib/format.ts";

test("counts: grouped, compact from 10k", () => {
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(1284), "1,284");
  assert.equal(formatCount(9999), "9,999");
  assert.equal(formatCount(12_400), "12.4k");
  assert.equal(formatCount(1_250_000), "1.3m");
});

test("currency: no cents unless under $10", () => {
  assert.equal(formatCurrency(1250), "$1,250");
  assert.equal(formatCurrency(29), "$29");
  assert.equal(formatCurrency(9.5), "$9.50");
  assert.equal(formatCurrency(5), "$5");
});

test("deltas: sign, real minus, one decimal", () => {
  assert.equal(formatDelta(0.182), "+18.2%");
  assert.equal(formatDelta(-0.041), "−4.1%");
  assert.equal(formatDelta(0), "0.0%");
  assert.equal(formatDelta(0.00001), "0.0%");
});

test("dates: year only outside the current year", () => {
  const now = new Date("2026-10-06T12:00:00");
  assert.equal(formatDate("2026-10-06T09:00:00", now), "Oct 6");
  assert.equal(formatDate("2025-03-14T09:00:00", now), "Mar 14, 2025");
});

test("relative times", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  assert.equal(formatRelative("2026-10-06T11:59:30Z", now), "just now");
  assert.equal(formatRelative("2026-10-06T11:55:00Z", now), "5m ago");
  assert.equal(formatRelative("2026-10-06T10:00:00Z", now), "2h ago");
  assert.equal(formatRelative("2026-10-03T12:00:00Z", now), "3d ago");
  assert.equal(formatRelative("2026-09-01T12:00:00Z", now), "Sep 1");
});
