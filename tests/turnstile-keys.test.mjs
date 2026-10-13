// Turnstile keys in production (src/lib/turnstile-keys.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { turnstileKeyProblems } from "../src/lib/turnstile-keys.ts";

const real = {
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAABkMYinukE8nzY",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAABkMYinukE8nzYxxxxxxxxxxxxxx",
};

test("production with real keys: fine", () => {
  assert.deepEqual(turnstileKeyProblems({ VERCEL_ENV: "production", ...real }), []);
});

test("production with any Cloudflare test key: blocked", () => {
  for (const prefix of ["1x0000", "2x0000", "3x0000"]) {
    const problems = turnstileKeyProblems({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: `${prefix}0000000000000000AA`,
      TURNSTILE_SECRET_KEY: `${prefix}000000000000000000000000000AA`,
    });
    assert.equal(problems.length, 2, prefix);
    assert.match(problems[0], /test key/);
  }
});

test("production with a key missing: blocked", () => {
  assert.deepEqual(
    turnstileKeyProblems({
      VERCEL_ENV: "production",
      TURNSTILE_SECRET_KEY: real.TURNSTILE_SECRET_KEY,
    }),
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set"],
  );
});

test("local and preview may use test keys", () => {
  const testKeys = {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  };
  assert.deepEqual(turnstileKeyProblems({ VERCEL_ENV: "preview", ...testKeys }), []);
  assert.deepEqual(turnstileKeyProblems(testKeys), []);
});
