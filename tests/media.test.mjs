// Pasted image links (src/lib/media.ts, SECURITY.md "Image links").
import assert from "node:assert/strict";
import { test } from "node:test";

import { imageLinkError, mediaHosts } from "../src/lib/media.ts";

test("mediaHosts parses the env list and drops junk", () => {
  assert.deepEqual(
    mediaHosts(" Images.YTAgencies.com , imagedelivery.net,,https://x.com, bad host "),
    ["images.ytagencies.com", "imagedelivery.net"],
  );
  assert.deepEqual(mediaHosts(undefined), []);
});

test("imageLinkError accepts https links on our hosts only", () => {
  const hosts = ["images.ytagencies.com"];
  assert.equal(imageLinkError("https://images.ytagencies.com/guides/cost.webp", hosts), null);
  for (const bad of [
    "http://images.ytagencies.com/a.png",
    "https://evil.com/a.png",
    "https://images.ytagencies.com.evil.com/a.png",
    "https://user:pw@images.ytagencies.com/a.png",
    "javascript:alert(1)",
    "images.ytagencies.com/a.png",
    "",
  ]) {
    assert.ok(imageLinkError(bad, hosts), bad);
  }
  assert.match(imageLinkError("https://images.ytagencies.com/a.png", []), /MEDIA_HOSTS/);
});
