// When Google Analytics may load (src/lib/analytics.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { gaId } from "../src/lib/analytics.ts";

const withEnv = (env, fn) => {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  try {
    return fn();
  } finally {
    process.env = saved;
  }
};

test("loads only with an ID and ALLOW_INDEXING exactly true", () => {
  assert.equal(
    withEnv({ NEXT_PUBLIC_GA_ID: "G-FQQQRPFK9N", ALLOW_INDEXING: "true" }, gaId),
    "G-FQQQRPFK9N",
  );
  assert.equal(
    withEnv({ NEXT_PUBLIC_GA_ID: "G-FQQQRPFK9N", ALLOW_INDEXING: undefined }, gaId),
    null,
  );
  assert.equal(withEnv({ NEXT_PUBLIC_GA_ID: "G-FQQQRPFK9N", ALLOW_INDEXING: "1" }, gaId), null);
  assert.equal(withEnv({ NEXT_PUBLIC_GA_ID: undefined, ALLOW_INDEXING: "true" }, gaId), null);
});

test("rejects anything that isn't a GA4 measurement ID", () => {
  assert.equal(withEnv({ NEXT_PUBLIC_GA_ID: "UA-1234-1", ALLOW_INDEXING: "true" }, gaId), null);
  assert.equal(
    withEnv({ NEXT_PUBLIC_GA_ID: "G-x');alert(1)//", ALLOW_INDEXING: "true" }, gaId),
    null,
  );
});
