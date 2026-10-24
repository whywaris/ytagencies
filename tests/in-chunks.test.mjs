// Long id filters go in batches (src/lib/supabase/in-chunks.ts): one URL with hundreds of UUIDs
// broke the production build (UND_ERR_HEADERS_OVERFLOW on /youtube-video-production-agencies).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { countInChunks, IN_CHUNK, inChunks } from "../src/lib/supabase/in-chunks.ts";

const ids = Array.from({ length: 450 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

test("batches of 100, every id once, rows joined", async () => {
  const seen = [];
  const { data, error } = await inChunks([...ids, ids[0]], async (batch) => {
    seen.push(batch.length);
    return { data: batch.map((id) => ({ id })), error: null };
  });
  assert.equal(error, null);
  assert.deepEqual(seen, [100, 100, 100, 100, 50]);
  assert.equal(data.length, 450);
  // A batch's URL stays far under the 16 KB header limit.
  assert.ok(IN_CHUNK * 37 < 6000);
});

test("an error in any batch is returned, and counts add up", async () => {
  const failing = await inChunks(ids, async (b) => (b[0] === ids[200] ? { data: null, error: "boom" } : { data: [], error: null }));
  assert.equal(failing.error, "boom");
  const { count } = await countInChunks(ids, async (b) => ({ count: b.length, error: null }));
  assert.equal(count, 450);
  assert.equal((await inChunks([], async () => ({ data: [1], error: null }))).data.length, 0);
});

test("the directory, combo counts, matching and profile views use batches", () => {
  const src = ["src/lib/data/agencies.ts", "src/lib/leads.tsx", "src/lib/data/agency-stats.ts"]
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  assert.doesNotMatch(src, /\.in\("id", (ids|serviceIds)\)|\.in\("agency_id", agencyIds\)/);
  assert.match(src, /inChunks\(ids, \(batch\) => listQuery\(\)\.in\("id", batch\)\)/);
});
