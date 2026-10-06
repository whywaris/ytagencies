// Dashboard periods and bucketing (src/lib/periods.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { countInBuckets, delta, parsePeriod, periodBuckets } from "../src/lib/periods.ts";

const now = new Date("2026-10-07T15:30:00Z");

test("unknown periods fall back to 30 days", () => {
  assert.equal(parsePeriod("7d"), "7d");
  assert.equal(parsePeriod("12m"), "12m");
  assert.equal(parsePeriod("1y"), "30d");
  assert.equal(parsePeriod(undefined), "30d");
});

test("7 days: daily buckets ending today, previous 7 days before", () => {
  const { current, previous } = periodBuckets("7d", now);
  assert.equal(current.length, 7);
  assert.equal(previous.length, 7);
  assert.equal(current.at(-1).start.toISOString(), "2026-10-07T00:00:00.000Z");
  assert.equal(current[0].start.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(previous.at(-1).end.toISOString(), current[0].start.toISOString());
  assert.equal(previous[0].start.toISOString(), "2026-09-24T00:00:00.000Z");
});

test("12 months: monthly buckets, across the year boundary", () => {
  const { current, previous } = periodBuckets("12m", now);
  assert.equal(current.length, 12);
  assert.equal(current.at(-1).start.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(current[0].start.toISOString(), "2025-11-01T00:00:00.000Z");
  assert.equal(previous[0].start.toISOString(), "2024-11-01T00:00:00.000Z");
  assert.equal(previous.at(-1).end.toISOString(), "2025-11-01T00:00:00.000Z");
});

test("counting is start-inclusive, end-exclusive, and ignores out-of-range", () => {
  const { current } = periodBuckets("7d", now);
  const counts = countInBuckets(
    [
      "2026-10-07T00:00:00Z", // today, first instant
      "2026-10-07T14:00:00Z",
      "2026-10-06T23:59:59Z", // yesterday
      "2026-09-30T23:59:59Z", // before the period
      "2026-10-08T00:00:00Z", // after it
    ],
    current,
  );
  assert.deepEqual(counts, [0, 0, 0, 0, 0, 1, 2]);
});

test("delta: ratio, or null without a base", () => {
  assert.equal(delta(12, 10), 0.2);
  assert.equal(delta(5, 10), -0.5);
  assert.equal(delta(3, 0), null);
  assert.equal(delta(0, 0), null);
});
