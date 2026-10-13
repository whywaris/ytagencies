// The header's account (src/lib/account.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { accountFrom } from "../src/lib/account.ts";

test("name from the provider, else the email before @; initial from the name", () => {
  const google = accountFrom({
    email: "ana@acme.test",
    user_metadata: { full_name: "Ana Pérez", avatar_url: "https://lh3.googleusercontent.com/a/x" },
  });
  assert.equal(google.name, "Ana Pérez");
  assert.equal(google.initial, "A");
  assert.equal(google.avatarUrl, "https://lh3.googleusercontent.com/a/x");

  const magic = accountFrom({ email: "waris@ytagencies.com", user_metadata: {} });
  assert.equal(magic.name, "waris");
  assert.equal(magic.initial, "W");
  assert.equal(magic.avatarUrl, null);

  assert.equal(accountFrom({ email: "x@y.test", user_metadata: { name: "Bo" } }).name, "Bo");
  assert.equal(
    accountFrom({
      email: "x@y.test",
      user_metadata: { picture: "https://lh3.googleusercontent.com/p" },
    }).avatarUrl,
    "https://lh3.googleusercontent.com/p",
  );
});

test("photos only from Google's image host, over https", () => {
  for (const url of [
    "https://evil.example/a.png",
    "http://lh3.googleusercontent.com/a",
    "javascript:alert(1)",
    "not a url",
  ])
    assert.equal(
      accountFrom({ email: "a@b.test", user_metadata: { avatar_url: url } }).avatarUrl,
      null,
      url,
    );
});
