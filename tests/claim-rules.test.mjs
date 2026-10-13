// Claiming (src/lib/claim-rules.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { alreadyManagedMessage, claimState, showClaimBar } from "../src/lib/claim-rules.ts";

test("an unclaimed published listing shows the claim bar", () => {
  assert.equal(claimState({ status: "published", isClaimed: false }), "open");
  assert.equal(showClaimBar({ status: "published", isClaimed: false }), true);
});

test("an owned listing hides it, whatever its plan", () => {
  assert.equal(claimState({ status: "published", isClaimed: true }), "managed");
  assert.equal(showClaimBar({ status: "published", isClaimed: true }), false);
});

test("drafts and archived listings can't be claimed from the public page", () => {
  for (const status of ["draft", "archived"])
    assert.equal(claimState({ status, isClaimed: false }), "unlisted", status);
});

test("the already-managed message names the help address", () => {
  assert.equal(
    alreadyManagedMessage("help@ytagencies.com"),
    "This listing is already managed by its owner. If you think this is a mistake, email help@ytagencies.com.",
  );
});

test("both claim server actions refuse an owned listing before saving anything", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = readFileSync(
    resolve(import.meta.dirname, "../src/lib/actions/claims.tsx"),
    "utf8",
  );
  for (const action of [
    "export async function startClaim",
    "export async function submitClaimProof",
  ]) {
    const body = source.slice(
      source.indexOf(action),
      source.indexOf("\nexport ", source.indexOf(action) + 1),
    );
    const guard = body.indexOf(
      'claimState({ status: "published", isClaimed: agency.is_claimed }) !== "open"',
    );
    const insert = body.indexOf('.from("claims")');
    assert.ok(guard > 0, `${action}: no owned-listing guard`);
    assert.ok(guard < insert, `${action}: guard must run before the claim is saved`);
    assert.match(body.slice(guard, guard + 200), /alreadyManagedMessage\(CONTACT_EMAIL\)/);
  }
});
