// Get matched in two steps: prefill from the link (src/lib/get-matched.ts) and step validation
// (src/lib/validation/lead.ts). Matching rules are in tests/match.test.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";

import { prefillFrom, STEP1_FIELDS } from "../src/lib/get-matched.ts";
import {
  budgetLabel,
  getMatchedSchema,
  getMatchedStep1,
  normalizeUrl,
} from "../src/lib/validation/lead.ts";

const services = ["youtube-ads-agencies", "youtube-seo-agencies"];
const industries = ["dentists", "saas"];

test("prefill: known service and industry from the link, flagged as from your search", () => {
  const p = prefillFrom(
    "?service=youtube-ads-agencies&industry=saas&ref=home",
    services,
    industries,
  );
  assert.deepEqual(
    { service: p.service, industry: p.industry, ref: p.ref, fromSearch: p.fromSearch },
    { service: "youtube-ads-agencies", industry: "saas", ref: "home", fromSearch: true },
  );
});

test("prefill: unknown slugs and bad refs are ignored; nothing to prefill means no note", () => {
  const p = prefillFrom("?service=hack&industry=<x>&ref=Bad Ref!", services, industries);
  assert.deepEqual(
    { service: p.service, industry: p.industry, ref: p.ref, fromSearch: p.fromSearch },
    { service: "", industry: "", ref: "", fromSearch: false },
  );
  assert.equal(
    prefillFrom("?need=%20Shorts%20for%20my%20clinic%20", [], []).message,
    "Shorts for my clinic",
  );
});

const step1 = {
  service: "youtube-ads-agencies",
  industry: "saas",
  goal: "leads-sales",
  budget: "1k-3k",
  start: "asap",
};

test("step 1: every field is required, each with its own message", () => {
  const r = getMatchedStep1.safeParse({ service: "", industry: "" });
  assert.equal(r.success, false);
  const fields = new Set(r.error.issues.map((i) => i.path[0]));
  for (const f of STEP1_FIELDS) assert.ok(fields.has(f), `${f} is required`);
  assert.equal(getMatchedStep1.safeParse(step1).success, true);
  assert.equal(
    getMatchedStep1.safeParse({ ...step1, budget: "1k-5k" }).success,
    false,
    "old range",
  );
});

const step2 = {
  name: "Ana",
  email: " Ana@Clinic.com ",
  businessUrl: "ytagencies.com",
  channelUrl: "youtube.com/@yourchannel",
  customerLocation: "Austin, US",
  priorAgency: "",
  message: "",
  turnstileToken: "t",
};

test("step 2: URLs are normalised, email lowercased, optional fields can be empty", () => {
  const r = getMatchedSchema.safeParse({ ...step1, ...step2 });
  assert.equal(r.success, true);
  assert.equal(r.data.email, "ana@clinic.com");
  assert.equal(r.data.businessUrl, "https://ytagencies.com/");
  assert.equal(r.data.channelUrl, "https://youtube.com/@yourchannel");
  const empty = getMatchedSchema.safeParse({ ...step1, ...step2, businessUrl: "", channelUrl: "" });
  assert.equal(empty.data.businessUrl, "");
});

test("step 2: a channel must be on YouTube; junk links and long fields are refused", () => {
  const bad = (o) => getMatchedSchema.safeParse({ ...step1, ...step2, ...o }).success;
  assert.equal(bad({ channelUrl: "vimeo.com/me" }), false);
  assert.equal(bad({ businessUrl: "javascript:alert(1)" }), false);
  assert.equal(bad({ businessUrl: "not a site" }), false);
  assert.equal(bad({ customerLocation: "x".repeat(121) }), false);
  assert.equal(bad({ message: "x".repeat(2001) }), false);
  assert.equal(normalizeUrl("http://user:pw@site.com"), null);
});

test("budget labels: the new ranges, and the old $1k–5k one on older leads", () => {
  assert.equal(budgetLabel("3k-5k"), "$3,000–$5,000 a month");
  assert.equal(budgetLabel("1k-5k"), "$1,000–$5,000 a month");
  assert.equal(budgetLabel(null), null);
});
