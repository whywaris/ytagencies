// Agency profile calls to action (src/app/(marketing)/agency/[slug]/page.tsx): one contact CTA,
// rendered either in the desktop sidebar card or the mobile bottom bar (never both), and one
// claim prompt, only for unclaimed listings.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { profileMode } from "../src/lib/profile-mode.ts";

const page = readFileSync(
  resolve(import.meta.dirname, "../src/app/(marketing)/agency/[slug]/page.tsx"),
  "utf8",
);
const header = page.slice(page.indexOf("{/* Header */}"), page.indexOf("</header>"));

test("every profile has exactly one quote CTA: 'Request a quote from {Agency}'", () => {
  for (const managed of [true, false]) {
    const m = profileMode({ managed, name: "Goat Agency" });
    assert.equal(m.ctaLabel, "Request a quote from Goat Agency");
  }
  // Two placements in the markup, one per breakpoint: the sidebar card (hidden below 980px)…
  const ctas = [...page.matchAll(/href=\{mode\.ctaHref\}/g)];
  assert.equal(ctas.length, 2);
  assert.match(
    page,
    /<aside aria-label="Summary" className="[^"]*\bhidden\b[^"]*min-\[980px\]:grid/,
  );
  // …and the bottom bar (hidden from 980px), so only one ever shows.
  assert.match(page, /className="profile-mbar [^"]*min-\[980px\]:hidden/);
});

test("the header has no contact or Request proposals button; the website is a plain link", () => {
  assert.doesNotMatch(header, /mode\.ctaHref|#contact/);
  assert.match(header, /<WebsiteLink /);
  assert.doesNotMatch(page, /WebsiteButton/);
});

test("one claim prompt, only while unclaimed", () => {
  assert.equal((page.match(/Claim this listing/g) ?? []).length, 1);
  assert.match(page, /showClaimBar\(\{ status: "published", isClaimed: agency\.isClaimed \}\) &&/);
  assert.doesNotMatch(page, /Manage this listing/);
});
