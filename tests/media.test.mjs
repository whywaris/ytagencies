// Pasted image links (src/lib/media.ts, SECURITY.md "Image links").
import assert from "node:assert/strict";
import { test } from "node:test";

import { initials, logoSrc } from "../src/lib/logo.ts";
import {
  checkLinkedImage,
  imageLinkError,
  linkedImageError,
  mediaHosts,
} from "../src/lib/media.ts";

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

// Logos and cover links (linkedImageError / checkLinkedImage) and the logo fallback (lib/logo.ts).

const R2 = ["media.ytagencies.com"];

test("linked image: allowed host, raster file, https only, no SVG", () => {
  assert.equal(linkedImageError("https://media.ytagencies.com/logos/acme.png", R2), null);
  assert.equal(linkedImageError("https://media.ytagencies.com/logos/acme.JPEG", R2), null);
  assert.match(
    linkedImageError("https://evil.example/logo.png", R2),
    /This host isn't allowed\. Use a media\.ytagencies\.com link\./,
  );
  assert.match(
    linkedImageError("https://media.ytagencies.com/logo.svg", R2),
    /SVG isn't supported/,
  );
  assert.match(linkedImageError("http://media.ytagencies.com/logo.png", R2), /https:\/\//);
  assert.match(linkedImageError("https://media.ytagencies.com/logo", R2), /\.png, \.webp/);
  assert.match(linkedImageError("not a link", R2), /full image link/);
  assert.match(linkedImageError("https://media.ytagencies.com/a.png", []), /MEDIA_HOSTS/);
});

const head = (status, headers) => async () =>
  new Response(null, { status, headers: new Headers(headers) });

test("linked image: HEAD must be 200, image/*, at most 1 MB", async () => {
  const url = "https://media.ytagencies.com/logos/acme.webp";
  const ok = { "content-type": "image/webp", "content-length": "52000" };
  assert.equal(await checkLinkedImage(url, { hosts: R2, fetchFn: head(200, ok) }), null);
  assert.match(await checkLinkedImage(url, { hosts: R2, fetchFn: head(404, ok) }), /returned 404/);
  assert.match(
    await checkLinkedImage(url, {
      hosts: R2,
      fetchFn: head(200, { ...ok, "content-type": "text/html" }),
    }),
    /isn't an image/,
  );
  assert.match(
    await checkLinkedImage(url, {
      hosts: R2,
      fetchFn: head(200, { ...ok, "content-length": "2000000" }),
    }),
    /over 1 MB/,
  );
  let called = false;
  const spy = async () => ((called = true), new Response(null, { status: 200 }));
  assert.match(
    await checkLinkedImage("https://evil.example/a.png", { hosts: R2, fetchFn: spy }),
    /isn't allowed/,
  );
  assert.equal(called, false, "a blocked host is never requested");
});

test("logo: a link or a stored upload; initials when there's none", () => {
  assert.equal(logoSrc("https://media.ytagencies.com/l.png"), "https://media.ytagencies.com/l.png");
  assert.match(
    logoSrc("agencies/1/logo.png"),
    /\/storage\/v1\/object\/public\/agency-media\/agencies\/1\/logo\.png$/,
  );
  assert.equal(logoSrc(""), null);
  assert.equal(logoSrc(null), null);
  assert.equal(initials("acme video co"), "AV");
  assert.equal(initials("Solo"), "S");
});
