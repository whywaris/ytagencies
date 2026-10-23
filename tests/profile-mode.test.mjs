// Managed vs unmanaged profiles (src/lib/profile-mode.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { profileMode } from "../src/lib/profile-mode.ts";

const base = {
  name: "Goat Agency",
  slug: "goat-agency",
  mainService: "youtube-ads-agencies",
  mainIndustry: "gaming",
};

test("managed: contact the agency, no similar agencies", () => {
  const m = profileMode({ ...base, managed: true });
  assert.equal(m.kind, "contact");
  assert.equal(m.ctaLabel, "Contact agency");
  assert.equal(m.ctaHref, "#contact");
  assert.equal(m.note, null);
  assert.equal(m.similar, false);
});

test("unmanaged: Request proposals, prefilled, with where it came from", () => {
  const m = profileMode({ ...base, managed: false });
  assert.equal(m.kind, "match");
  assert.equal(m.ctaLabel, "Request proposals from similar agencies");
  const url = new URL(m.ctaHref, "https://ytagencies.com");
  assert.equal(url.pathname, "/request-proposals");
  assert.equal(url.searchParams.get("service"), "youtube-ads-agencies");
  assert.equal(url.searchParams.get("industry"), "gaming");
  assert.equal(url.searchParams.get("ref"), "profile:goat-agency");
  assert.equal(
    m.note,
    "Goat Agency hasn't joined YT Agencies yet, so we can't pass messages to them. We'll match you with similar agencies that reply.",
  );
  assert.equal(m.similar, true);
});

test("unmanaged without an industry: only what we know goes in the link", () => {
  const m = profileMode({ ...base, managed: false, mainIndustry: null });
  const url = new URL(m.ctaHref, "https://ytagencies.com");
  assert.equal(url.searchParams.has("industry"), false);
  assert.equal(url.searchParams.get("service"), "youtube-ads-agencies");
});
