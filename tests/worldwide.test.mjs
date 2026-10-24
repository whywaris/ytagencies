// Worldwide programmatic pages (src/lib/sitemap-core.ts, src/lib/locations.ts): every page type
// goes live at 3 agencies and drops to noindex below, remote agencies never appear as "based in",
// no empty place page exists, and copy comes from real data only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  citySlug,
  cleanCityName,
  dataIntro,
  hubTitle,
  pageFacts,
  splitByPlace,
} from "../src/lib/locations.ts";
import {
  countDirectoryPages,
  livePagesOf,
  pageTypeOf,
  sitemapParts,
  SITEMAP_MAX_URLS,
} from "../src/lib/sitemap-core.ts";

// usa (1) ← new-york (2); uk (3)
const locations = [
  { id: 1, slug: "usa", parentId: null },
  { id: 2, slug: "new-york", parentId: 1 },
  { id: 3, slug: "uk", parentId: null },
];
const agency = (n, extra = {}) => ({
  updatedAt: `2026-10-0${n}T00:00:00Z`,
  services: ["youtube-ads-agencies"],
  industries: ["saas"],
  locationIds: [2],
  ...extra,
});
const live = (published, type) =>
  livePagesOf(countDirectoryPages(published, locations).paths, type, 3);

test("every page type goes live at 3 agencies and drops out below", () => {
  const two = [agency(1), agency(2)];
  const three = [...two, agency(3)];
  for (const [type, path] of [
    ["service", "/youtube-ads-agencies"],
    ["industry", "/industries/saas"],
    ["location", "/locations/usa"],
    ["location", "/locations/usa/new-york"],
    ["service-industry", "/youtube-ads-agencies/for-saas"],
    ["service-location", "/youtube-ads-agencies/in-new-york"],
    ["service-location", "/youtube-ads-agencies/in-usa"],
    ["service-industry-location", "/youtube-ads-agencies/for-saas/in-usa"],
  ]) {
    assert.equal(pageTypeOf(path), type, path);
    assert.ok(!live(two, type).some((e) => e.path === path), `${path} not live at 2`);
    assert.ok(
      live(three, type).some((e) => e.path === path),
      `${path} live at 3`,
    );
  }
  // A city counts toward its country; triples are countries only.
  assert.ok(!live(three, "service-industry-location").some((e) => e.path.endsWith("in-new-york")));
});

test("lastmod is the newest agency on the page", () => {
  const [usa] = live([agency(1), agency(5), agency(3)], "location");
  assert.equal(usa.lastModified, "2026-10-05T00:00:00Z");
});

test("no empty place page: paths exist only where an agency is", () => {
  const { paths } = countDirectoryPages([agency(1, { locationIds: [3] })], locations);
  assert.ok(paths.has("/locations/uk"));
  assert.ok(!paths.has("/locations/usa"), "no agency in the USA: no page");
  assert.ok(!paths.has("/locations/usa/new-york"));
  assert.ok([...paths.values()].every((p) => p.count > 0));
  // Location pages 404 with nobody on them; triples below 3.
  const hub = readFileSync("src/components/directory/location-hub.tsx", "utf8");
  assert.match(hub, /if \(based\.length \+ remote\.length === 0\) notFound\(\);/);
  const triple = readFileSync(
    "src/app/(marketing)/[service]/[segment]/[location]/page.tsx",
    "utf8",
  );
  assert.match(triple, /< MIN_AGENCIES_TO_INDEX\) notFound\(\);/);
});

test("remote agencies never appear in the 'based in' section", () => {
  const usa = new Set([1, 2]);
  const items = [
    { id: "local-city", hqLocationId: 2, locationIds: [2] },
    { id: "local-country", hqLocationId: 1, locationIds: [1, 3] },
    { id: "remote", hqLocationId: 3, locationIds: [3, 1] },
    { id: "no-hq", hqLocationId: null, locationIds: [2] },
    { id: "elsewhere", hqLocationId: 3, locationIds: [3] },
  ];
  const { based, remote } = splitByPlace(items, usa);
  assert.deepEqual(
    based.map((a) => a.id),
    ["local-city", "local-country"],
  );
  assert.deepEqual(
    remote.map((a) => a.id),
    ["remote", "no-hq"],
  );
  assert.ok(
    !items.find((a) => a.id === "elsewhere") ||
      ![...based, ...remote].some((a) => a.id === "elsewhere"),
  );
});

test("cities: slugs are global, a clash gets the country code; names are checked", () => {
  assert.equal(citySlug("São Paulo", "BR", new Set()), "sao-paulo");
  assert.equal(citySlug("London", "CA", new Set(["london"])), "london-ca");
  assert.equal(citySlug("London", "CA", new Set(["london", "london-ca"])), "london-ca-2");
  assert.equal(cleanCityName("  New   York "), "New York");
  assert.equal(cleanCityName("Lahore123"), null);
  assert.equal(cleanCityName("<script>"), null);
  assert.equal(cleanCityName("A"), null);
});

const item = (name, extra = {}) => ({
  name,
  minBudgetUsd: null,
  pricingModel: null,
  isVerified: false,
  createdAt: "2026-10-01T00:00:00Z",
  services: [],
  industries: [],
  ...extra,
});

test("intro from real data only: no zero counts, nothing made up", () => {
  const intro = dataIntro("YouTube agencies in Pakistan", pageFacts([item("A"), item("B")]));
  assert.equal(
    intro,
    "There are 2 listings for YouTube agencies in Pakistan. The newest listing is A.",
  );
  assert.doesNotMatch(intro, /\b0\b|Verified|range/);
  const rich = dataIntro(
    "x",
    pageFacts([
      item("A", {
        minBudgetUsd: 1000,
        pricingModel: "retainer",
        isVerified: true,
        createdAt: "2026-10-09T00:00:00Z",
      }),
      item("B", { minBudgetUsd: 3000, pricingModel: "retainer" }),
    ]),
  );
  assert.match(rich, /Starting prices range from \$1k to \$3k\./);
  assert.match(rich, /Most charge a monthly retainer\./);
  assert.match(rich, /1 is Verified\./);
  assert.match(rich, /The newest listing is A\./);
  assert.equal(dataIntro("x", pageFacts([])), "");
});

test("titles stay within 60 characters; sitemaps split above 50,000 URLs", () => {
  const t = hubTitle("YouTube Agencies in United Arab Emirates", 2026, "YT Agencies");
  assert.ok(t.length <= 60, t);
  assert.equal(sitemapParts(0), 1);
  assert.equal(sitemapParts(SITEMAP_MAX_URLS), 1);
  assert.equal(sitemapParts(SITEMAP_MAX_URLS + 1), 2);
});
