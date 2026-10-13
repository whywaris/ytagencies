// Agency profile meta title / description and the thin-profile rule (src/lib/profile-seo.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { agencyDescription, agencyTitle, thinProfileMissing } from "../src/lib/profile-seo.ts";

const brand = "YT Agencies";

test("title: industry with 40%+ focus, else city", () => {
  assert.equal(
    agencyTitle({
      name: "Goat",
      service: "YouTube Ads",
      focusIndustry: "Gaming",
      city: "London",
      brand,
    }),
    "Goat: YouTube Ads Agency for Gaming | YT Agencies",
  );
  assert.equal(
    agencyTitle({
      name: "Goat",
      service: "YouTube Ads",
      focusIndustry: null,
      city: "London",
      brand,
    }),
    "Goat: YouTube Ads Agency in London | YT Agencies",
  );
  assert.equal(
    agencyTitle({ name: "Goat", service: null, focusIndustry: null, city: null, brand }),
    "Goat: YouTube Agency | YT Agencies",
  );
});

test("title: too long drops the brand, then for/in, never the name or service", () => {
  const long = { name: "Northwake Media", service: "Influencer Marketing", city: "London", brand };
  assert.equal(
    agencyTitle({ ...long, focusIndustry: "E-commerce" }),
    "Northwake Media: Influencer Marketing Agency for E-commerce",
  );
  assert.equal(
    agencyTitle({ ...long, focusIndustry: "Coaches & consultants" }),
    "Northwake Media: Influencer Marketing Agency",
  );
  const huge = "The Very Long Named Creative Video Production Company";
  const t = agencyTitle({
    name: huge,
    service: "Video Production",
    focusIndustry: null,
    city: "London",
    brand,
  });
  assert.equal(t, `${huge}: Video Production Agency`);
  for (const s of [long, { ...long, focusIndustry: "Gaming" }])
    assert.ok(agencyTitle({ focusIndustry: null, ...s }).length <= 60);
});

const rich = {
  name: "Northwake Media",
  city: "London",
  service: "Influencer Marketing",
  industries: ["E-commerce", "Gaming", "Fitness"],
  price: 3000,
  pricingModel: "retainer",
  minContract: "3_months",
};

test("description: the full sentence when it fits", () => {
  assert.equal(
    agencyDescription({ ...rich, name: "Goat Agency", service: "YouTube Ads" }),
    "Goat Agency is a London-based YouTube ads agency for e-commerce and gaming brands. From $3,000/month, 3-month minimum. See channels, pricing and reviews.",
  );
});

test("description: a long one drops the 2nd industry, then shortens the last sentence (140–160)", () => {
  const d = agencyDescription(rich);
  assert.equal(
    d,
    "Northwake Media is a London-based YouTube influencer marketing agency for e-commerce brands. From $3,000/month, 3-month minimum. See pricing and reviews.",
  );
  assert.ok(d.length >= 140 && d.length <= 160, String(d.length));
});

test("description: shortens by dropping the second industry, then the last sentence", () => {
  const d = agencyDescription({
    ...rich,
    name: "Northwake Media Creative Studio",
    industries: ["Coaches & consultants", "Doctors & clinics"],
  });
  assert.ok(d.length <= 160, d);
  assert.ok(!d.includes("doctors"), d);
  const d2 = agencyDescription({
    ...rich,
    name: "Northwake Media Creative Studio and Partners International",
    industries: ["Coaches & consultants"],
  });
  assert.ok(d2.length <= 160, d2);
  assert.ok(!d2.includes("See channels"), d2);
});

test("description: sparse input skips missing parts cleanly", () => {
  assert.equal(
    agencyDescription({
      name: "Goat",
      city: null,
      service: "YouTube Ads",
      industries: [],
      price: 800,
      pricingModel: "per_video",
      minContract: null,
    }),
    "Goat is a YouTube ads agency. From $800/video. See channels, pricing and reviews.",
  );
  assert.equal(
    agencyDescription({
      name: "Goat",
      city: "Austin",
      service: "YouTube SEO",
      industries: ["SaaS"],
      price: null,
      pricingModel: null,
      minContract: "none",
    }),
    "Goat is an Austin-based YouTube SEO agency for SaaS brands. See channels, pricing and reviews.",
  );
});

test("description: a / an by sound", () => {
  const base = {
    service: "YouTube Ads",
    industries: [],
    price: null,
    pricingModel: null,
    minContract: null,
  };
  assert.match(
    agencyDescription({ ...base, name: "Goat", city: "United States" }),
    /^Goat is a United States-based/,
  );
  assert.match(
    agencyDescription({ ...base, name: "Goat", city: "Edinburgh" }),
    /^Goat is an Edinburgh-based/,
  );
  assert.match(
    agencyDescription({ ...base, name: "Goat", city: "Europe" }),
    /^Goat is a Europe-based/,
  );
});

test("thin profiles: what's missing", () => {
  assert.deepEqual(
    thinProfileMissing({
      hasDescription: false,
      hasBestFor: false,
      industries: 1,
      hasPrice: false,
    }),
    ["a description or a “best for” line", "at least 2 industries", "a starting price"],
  );
  assert.deepEqual(
    thinProfileMissing({ hasDescription: false, hasBestFor: true, industries: 2, hasPrice: true }),
    [],
  );
});
