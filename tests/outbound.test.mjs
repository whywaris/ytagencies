// Outbound agency website links (src/lib/outbound.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { agencyWebsiteLink } from "../src/lib/outbound.ts";

test("Pro and Founding: sponsored, new tab, never noreferrer", () => {
  for (const plan of ["pro", "founding"]) {
    const link = agencyWebsiteLink("https://www.acmemedia.com/", plan, "profile");
    assert.equal(link.rel, "sponsored noopener", plan);
    assert.equal(link.target, "_blank");
    assert.doesNotMatch(link.rel, /noreferrer/);
    assert.equal(link.label, "acmemedia.com");
    const params = new URL(link.href).searchParams;
    assert.equal(params.get("utm_source"), "ytagencies");
    assert.equal(params.get("utm_medium"), "referral");
    assert.equal(params.get("utm_campaign"), "directory_listing");
    assert.equal(params.get("utm_content"), "profile");
  }
});

test("Free: no website link", () => {
  assert.equal(agencyWebsiteLink("https://acmemedia.com", "free", "profile"), null);
  assert.equal(agencyWebsiteLink("https://acmemedia.com", "verified", "profile"), null);
});

test("keeps the agency's query string, doesn't duplicate utm params", () => {
  const link = agencyWebsiteLink(
    "https://acmemedia.com/work?ref=yt&utm_source=old&utm_content=x#top",
    "pro",
    "directory",
  );
  const url = new URL(link.href);
  assert.equal(url.searchParams.get("ref"), "yt");
  assert.deepEqual(url.searchParams.getAll("utm_source"), ["ytagencies"]);
  assert.deepEqual(url.searchParams.getAll("utm_content"), ["directory"]);
  assert.equal(url.pathname, "/work");
  assert.equal(url.hash, "#top");
});

test("no link without a usable http(s) website", () => {
  assert.equal(agencyWebsiteLink(null, "pro", "profile"), null);
  assert.equal(agencyWebsiteLink("not a url", "pro", "profile"), null);
  assert.equal(agencyWebsiteLink("javascript:alert(1)", "pro", "profile"), null);
});
