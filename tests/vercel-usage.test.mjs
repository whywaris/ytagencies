// Keeping Vercel usage down: which commits deploy, and the one daily cron.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("one cron: the daily guides sweep", () => {
  const { crons } = JSON.parse(read("vercel.json"));
  assert.deepEqual(
    crons.map((c) => c.path),
    ["/api/cron/guides"],
  );
});

test("docs-only commits and bot branches don't deploy", () => {
  const { ignoreCommand } = JSON.parse(read("vercel.json"));
  assert.ok(ignoreCommand.length <= 256, "Vercel's limit");
  assert.match(ignoreCommand, /dependabot\/\*\|claude\/\*\) exit 0/);
  // Against the last deployed commit, so code followed by a docs commit in one push still deploys.
  assert.match(ignoreCommand, /\$\{VERCEL_GIT_PREVIOUS_SHA:-HEAD\^\} HEAD/);
  for (const dir of ["docs", "tests", "e2e", "scripts", "supabase", ".github", "*.md"])
    assert.ok(ignoreCommand.includes(`':!${dir}'`), dir);
  // Anything that ships stays in: src and public aren't excluded.
  assert.doesNotMatch(ignoreCommand, /:!(src|public)/);
  assert.match(ignoreCommand, /\|\| exit 1$/); // any git failure builds rather than skips
});
