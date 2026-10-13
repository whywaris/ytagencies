// Sitemaps and llms.txt (src/lib/sitemap-core.ts), with the rules the pages use for their robots
// meta: thinProfileMissing (agency profiles) and MIN_AGENCIES_TO_INDEX (directory pages).
import assert from "node:assert/strict";
import { test } from "node:test";

import { thinProfileMissing } from "../src/lib/profile-seo.ts";
import {
  agencyEntries,
  directoryEntries,
  indexXml,
  llmsTxt,
  sitemapSafe,
  urlsetXml,
} from "../src/lib/sitemap-core.ts";
import { MIN_AGENCIES_TO_INDEX } from "../src/lib/site.ts";

const absolute = (p) => `https://ytagencies.com${p}`;
const full = { hasDescription: true, hasBestFor: true, industries: 2, hasPrice: true };

test("agencies: an indexable profile is in, a thin one is out", () => {
  const entries = agencyEntries([
    { slug: "goat-agency", updatedAt: "2026-10-01T10:00:00Z", missing: thinProfileMissing(full) },
    {
      slug: "thin-co",
      updatedAt: "2026-10-02T10:00:00Z",
      missing: thinProfileMissing({ ...full, hasPrice: false }),
    },
  ]);
  assert.deepEqual(entries, [
    { path: "/agency/goat-agency", lastModified: "2026-10-01T10:00:00Z" },
  ]);
  const xml = urlsetXml(entries, absolute);
  assert.match(
    xml,
    /<loc>https:\/\/ytagencies\.com\/agency\/goat-agency<\/loc><lastmod>2026-10-01T10:00:00\.000Z<\/lastmod>/,
  );
  assert.doesNotMatch(xml, /thin-co/);
});

test("directory pages: below the 3-agency rule they're left out; for- and in- are split", () => {
  const pages = [
    {
      serviceSlug: "youtube-ads-agencies",
      segment: "for-gaming",
      count: MIN_AGENCIES_TO_INDEX,
      lastModified: "2026-10-01",
    },
    {
      serviceSlug: "youtube-ads-agencies",
      segment: "for-dentists",
      count: MIN_AGENCIES_TO_INDEX - 1,
      lastModified: "2026-10-01",
    },
    {
      serviceSlug: "youtube-ads-agencies",
      segment: "in-usa",
      count: 5,
      lastModified: "2026-10-01",
    },
  ];
  assert.deepEqual(
    directoryEntries(pages, MIN_AGENCIES_TO_INDEX, "for").map((e) => e.path),
    ["/youtube-ads-agencies/for-gaming"],
  );
  assert.deepEqual(
    directoryEntries(pages, MIN_AGENCIES_TO_INDEX, "in").map((e) => e.path),
    ["/youtube-ads-agencies/in-usa"],
  );
});

test("never private areas or URLs with a query string, even if passed in", () => {
  for (const path of [
    "/dashboard",
    "/dashboard/goat-agency",
    "/admin",
    "/login",
    "/auth/callback",
    "/claim/x",
    "/api/events",
    "/youtube-ads-agencies?budget=1",
  ])
    assert.equal(sitemapSafe(path), false, path);
  const xml = urlsetXml(
    [{ path: "/" }, { path: "/dashboard" }, { path: "/admin/leads" }],
    absolute,
  );
  assert.match(xml, /<loc>https:\/\/ytagencies\.com\/<\/loc>/);
  assert.doesNotMatch(xml, /dashboard|admin/);
});

test("absolute URLs on the apex domain, no lastmod when there's no real date", () => {
  const xml = urlsetXml([{ path: "/about" }], absolute);
  assert.match(xml, /<url><loc>https:\/\/ytagencies\.com\/about<\/loc><\/url>/);
  assert.doesNotMatch(xml, /www\.ytagencies|priority|changefreq/);
});

test("the index lists each child sitemap with its newest date", () => {
  const xml = indexXml([
    { url: "https://ytagencies.com/sitemaps/agencies.xml", lastModified: "2026-10-02" },
    { url: "https://ytagencies.com/sitemaps/authors.xml", lastModified: null },
  ]);
  assert.match(xml, /<sitemapindex /);
  assert.match(
    xml,
    /<sitemap><loc>https:\/\/ytagencies\.com\/sitemaps\/agencies\.xml<\/loc><lastmod>2026-10-02T00:00:00\.000Z<\/lastmod><\/sitemap>/,
  );
  assert.match(
    xml,
    /<sitemap><loc>https:\/\/ytagencies\.com\/sitemaps\/authors\.xml<\/loc><\/sitemap>/,
  );
});

test("llms.txt: H1, one-line summary, and a Services section", () => {
  const txt = llmsTxt({
    brand: "YT Agencies",
    summary: "An independent directory.",
    about: "Listings are free.",
    services: [
      { title: "YouTube Ads agencies", url: absolute("/youtube-ads-agencies"), note: "Ads." },
    ],
    industries: [],
    comparisons: [],
    guides: [],
    pages: [{ title: "About", url: absolute("/about") }],
  });
  assert.match(txt, /^# YT Agencies\n/);
  assert.match(txt, /\n> An independent directory\.\n/);
  assert.match(
    txt,
    /\n## Services\n\n- \[YouTube Ads agencies\]\(https:\/\/ytagencies\.com\/youtube-ads-agencies\): Ads\.\n/,
  );
  assert.doesNotMatch(txt, /## Industries/); // empty sections are left out
  assert.match(txt, /## About/);
});
