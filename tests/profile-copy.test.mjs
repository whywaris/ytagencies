// Generated profile copy (src/lib/profile-copy.ts): only facts we hold, plain sentences.
import assert from "node:assert/strict";
import { test } from "node:test";

import { faq, glance, list, priceSentence } from "../src/lib/profile-copy.ts";

const rich = {
  name: "Northwake Media",
  city: "London",
  country: "United Kingdom",
  foundedYear: 2019,
  teamSize: "11-50",
  services: ["Influencer Marketing", "YouTube Shorts", "Video Production"],
  industries: ["E-commerce", "Gaming", "Fitness"],
  startingPrice: 3000,
  pricingModel: "retainer",
  minContract: "3_months",
  adSpend: "separate",
  setupFee: 100,
};

test("glance: a rich profile reads as three plain sentences", () => {
  assert.equal(
    glance(rich),
    "Northwake Media is a London-based YouTube agency founded in 2019 with 11–50 people. " +
      "It offers influencer marketing, YouTube Shorts and video production, mostly for e-commerce, gaming and fitness clients. " +
      "Pricing starts at $3,000 per month on a monthly retainer with a 3-month minimum; ad spend is paid separately to Google.",
  );
});

test("glance: a sparse profile states only what we know", () => {
  assert.equal(
    glance({
      ...rich,
      city: null,
      country: null,
      foundedYear: null,
      teamSize: null,
      services: ["YouTube Ads"],
      industries: [],
      pricingModel: "project",
      minContract: null,
      adSpend: null,
      setupFee: null,
    }),
    "Northwake Media is a YouTube agency. It offers YouTube Ads. Pricing starts at $3,000 per project.",
  );
});

test("faq: questions only when we can answer them", () => {
  const items = faq({
    ...rich,
    industryFocus: [
      { name: "E-commerce", pct: 40 },
      { name: "Gaming", pct: 35 },
      { name: "Fitness", pct: 25 },
    ],
    otherLocations: ["United States"],
    replyLabel: "Usually replies within a day",
    replyCount: 6,
  });
  assert.deepEqual(
    items.map((i) => i.answer),
    [
      "Pricing starts at $3,000 per month on a monthly retainer, plus a $100 setup fee. Ad spend is paid separately to Google.",
      "Yes. There is a 3-month minimum.",
      "Mostly e-commerce (40%), gaming (35%) and fitness (25%).",
      "London, United Kingdom. It also works with clients in United States.",
      "Usually within a day, based on 6 inquiries in the last 90 days.",
    ],
  );
  const sparse = faq({
    ...rich,
    city: null,
    country: null,
    minContract: null,
    startingPrice: null,
    industryFocus: [],
    otherLocations: [],
    replyLabel: null,
    replyCount: null,
  });
  assert.equal(sparse.length, 0);
});

test("helpers", () => {
  assert.equal(list(["a"]), "a");
  assert.equal(list(["a", "b", "c"]), "a, b and c");
  assert.equal(priceSentence(800, "per_video"), "$800 per video");
});
