// /agencies (src/lib/browse.ts): filters, the budget rule, search, sort orders, pagination and
// indexing. Recommended is the shared merit ranking (src/lib/ranking.ts), which Pro never changes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  browse,
  browseDescription,
  browseTitle,
  browseQuery,
  browseRobots,
  cleanQuery,
  filterCount,
  pageNumbers,
  parseBrowse,
  prefixQuery,
} from "../src/lib/browse.ts";
import { rankAgencies } from "../src/lib/ranking.ts";

const options = {
  services: ["youtube-ads-agencies", "youtube-seo-agencies"],
  industries: ["saas", "dentists"],
  countries: ["usa", "uk"],
  pricing: ["retainer", "project"],
  teams: ["1-10", "11-50"],
};
const tag = (slug, name) => ({ slug, name });
const agency = (id, extra = {}) => ({
  id,
  name: id,
  isVerified: false,
  managed: false,
  quality: 50,
  minBudgetUsd: null,
  pricingModel: null,
  teamSize: null,
  createdAt: "2026-10-01T00:00:00Z",
  services: [],
  industries: [],
  countries: [],
  ...extra,
});
const ads = tag("youtube-ads-agencies", "YouTube Ads");
const seo = tag("youtube-seo-agencies", "YouTube SEO");
const saas = tag("saas", "SaaS");

const pool = rankAgencies(
  [
    agency("Alpha", {
      services: [ads],
      industries: [saas],
      countries: ["usa"],
      minBudgetUsd: 1000,
    }),
    agency("Bravo", { services: [seo], countries: ["uk"], minBudgetUsd: 3000, teamSize: "1-10" }),
    agency("Charlie", { services: [ads], isVerified: true, pricingModel: "retainer" }),
    agency("Delta", {
      minBudgetUsd: 12000,
      pricingModel: "project",
      createdAt: "2026-10-20T00:00:00Z",
    }),
  ],
  [],
  false,
);
const run = (params, searchIds = null) =>
  browse(pool, parseBrowse(params, options), searchIds).items.map((a) => a.id);

test("each filter narrows the list", () => {
  assert.deepEqual(run({ verified: "1" }), ["Charlie"]);
  assert.deepEqual(run({ service: "youtube-ads-agencies" }), ["Charlie", "Alpha"]);
  assert.deepEqual(run({ service: "youtube-ads-agencies,youtube-seo-agencies" }).length, 3);
  assert.deepEqual(run({ industry: "saas" }), ["Alpha"]);
  assert.deepEqual(run({ country: "uk" }), ["Bravo"]);
  assert.deepEqual(run({ pricing: "retainer,project" }), ["Charlie", "Delta"]);
  assert.deepEqual(run({ team: "1-10" }), ["Bravo"]);
  // Unknown values from a hand-edited URL are ignored, not matched against.
  assert.equal(run({ industry: "made-up", service: "nope" }).length, 4);
});

test("budget: min ≤ the top of the range; no starting price only shows for Any", () => {
  assert.deepEqual(run({ budget: "under-1k" }), ["Alpha"]);
  assert.deepEqual(run({ budget: "1k-3k" }), ["Alpha", "Bravo"]);
  assert.deepEqual(run({ budget: "10k-plus" }), ["Alpha", "Bravo", "Delta"]);
  assert.equal(run({}).length, 4, "Any shows agencies without a price too");
  // A chip (submit button) comes after the hidden current value: the last one wins.
  assert.deepEqual(run({ budget: ["5k-10k", "under-1k"] }), ["Alpha"]);
});

test("search: the tsvector hits, plus service and industry names; input is sanitised", () => {
  assert.deepEqual(run({ q: "bra" }, new Set(["Bravo"])), ["Bravo"]);
  assert.deepEqual(run({ q: "saas" }, new Set()), ["Alpha"], "industry name");
  assert.deepEqual(run({ q: "youtube ads" }, new Set()), ["Charlie", "Alpha"], "service name");
  assert.equal(cleanQuery(" <script>alert(1)</script> "), "script alert 1 script");
  assert.equal(cleanQuery("x".repeat(150)).length, 100);
  assert.equal(prefixQuery("YouTube ads!"), "youtube:* & ads:*");
  assert.equal(prefixQuery("  & | ! "), null, "no tsquery operators get through");
});

test("sort: Recommended = merit (verified, quality, name), Pro has no effect", () => {
  assert.deepEqual(run({}), ["Charlie", "Alpha", "Bravo", "Delta"]);
  const flipped = rankAgencies(
    pool.map((a) => ({ ...a, managed: !a.managed })),
    [],
    false,
  );
  assert.deepEqual(
    browse(flipped, parseBrowse({}, options), null).items.map((a) => a.id),
    run({}),
  );
  assert.deepEqual(run({ sort: "price" }), ["Alpha", "Bravo", "Delta", "Charlie"]);
  assert.deepEqual(run({ sort: "newest" })[0], "Delta");
  assert.equal(parseBrowse({ sort: "evil" }, options).sort, "recommended");
});

test("pagination: 20 per page, a page past the end shows the last one", () => {
  const many = Array.from({ length: 45 }, (_, i) => agency(`A${String(i).padStart(2, "0")}`));
  const f = (page) => parseBrowse({ page: String(page) }, options);
  assert.equal(browse(many, f(1), null).items.length, 20);
  assert.equal(browse(many, f(3), null).items.length, 5);
  assert.deepEqual(browse(many, f(9), null).page, 3);
  assert.equal(browse(many, f(2), null).items[0].id, "A20");
  assert.deepEqual(pageNumbers(1, 3), [1, 2, 3]);
  assert.deepEqual(pageNumbers(6, 12), [1, "gap", 4, 5, 6, 7, 8, "gap", 12]);
  assert.equal(browseQuery({ page: 2, sort: "recommended" }), "?page=2");
});

test("indexing: /agencies and ?page=N self-canonical; any filter is noindex → /agencies", () => {
  assert.deepEqual(browseRobots({}), { noindex: false, canonical: "/agencies", page: 1 });
  assert.deepEqual(browseRobots({ page: "3" }), {
    noindex: false,
    canonical: "/agencies?page=3",
    page: 3,
  });
  for (const params of [
    { q: "x" },
    { service: "a" },
    { verified: "1" },
    { sort: "newest", page: "2" },
  ])
    assert.deepEqual(browseRobots(params), { noindex: true, canonical: "/agencies", page: 1 });
  assert.equal(browseRobots({ q: "" }).noindex, false, "an empty param isn't a filter");
});

test("empty state: nothing matches, and the page says so with a way out", () => {
  const r = browse(pool, parseBrowse({ industry: "dentists" }, options), null);
  assert.equal(r.total, 0);
  assert.equal(r.pages, 1);
  const page = readFileSync("src/app/(marketing)/agencies/page.tsx", "utf8");
  assert.match(page, /No agencies match these filters\./);
  assert.match(page, /Clear filters/);
  assert.match(page, /href=\{proposals\}/);
  assert.equal(
    filterCount(parseBrowse({ verified: "1", service: "youtube-ads-agencies" }, options)),
    2,
  );
});

test("title ≤ 60 and description 140–160, with the head term and the live count", () => {
  const t = browseTitle(2026, 1, "YT Agencies");
  assert.equal(t, "Best YouTube Marketing Agencies (2026) | YT Agencies");
  assert.ok(t.length <= 60);
  assert.ok(browseTitle(2026, 12, "YT Agencies").includes("Page 12"));
  assert.ok(browseTitle(2026, 12, "YT Agencies").length <= 60);
  for (const n of [9, 134, 12345]) {
    const d = browseDescription(n);
    assert.ok(d.length >= 140 && d.length <= 160, `${d.length}: ${d}`);
    assert.match(d, new RegExp(new Intl.NumberFormat("en-US").format(n)));
  }
});
