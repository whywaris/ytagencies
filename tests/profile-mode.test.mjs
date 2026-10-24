// Every profile takes quote requests (src/lib/profile-mode.ts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { profileMode, quoteConsent } from "../src/lib/profile-mode.ts";

test("Pro: Request a quote, no similar agencies", () => {
  const m = profileMode({ name: "Goat Agency", managed: true });
  assert.deepEqual(m, {
    ctaLabel: "Request a quote from Goat Agency",
    ctaHref: "#contact",
    similar: false,
  });
});

test("not on Pro (claimed or not): the same quote form, plus similar agencies", () => {
  const m = profileMode({ name: "Goat Agency", managed: false });
  assert.equal(m.ctaLabel, "Request a quote from Goat Agency");
  assert.equal(m.ctaHref, "#contact");
  assert.equal(m.similar, true);
  // The old "can't pass messages" note is gone everywhere.
  const page = readFileSync("src/app/(marketing)/agency/[slug]/page.tsx", "utf8");
  assert.doesNotMatch(page, /can't pass messages|hasn't joined/);
});

test("the form shows and requires the 48-hour consent", () => {
  assert.equal(
    quoteConsent("Goat Agency"),
    "Your request goes to Goat Agency. If they don't reply within 48 hours, we'll send it to up to 3 similar agencies.",
  );
  const form = readFileSync("src/components/forms/contact-agency-form.tsx", "utf8");
  assert.match(form, /quoteConsent\(agencyName\)/);
  assert.match(form, /register\("consent"\)/);
  const schema = readFileSync("src/lib/validation/lead.ts", "utf8");
  assert.match(schema, /consent: z\.boolean\(\)\.refine\(\(v\) => v,/);
});
