// Sitemaps and llms.txt (src/lib/sitemap-core.ts): pages, guides and authors only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  SITEMAP_CACHE_CONTROL,
  SITEMAP_FILES,
  indexXml,
  llmsTxt,
  sitemapSafe,
  urlsetXml,
} from "../src/lib/sitemap-core.ts";

const absolute = (p) => `https://ytagencies.com${p}`;
const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("the blog's sitemaps: pages, guides and authors, nothing from the old directory", () => {
  assert.deepEqual([...SITEMAP_FILES], ["pages", "guides", "authors"]);
  const pages = read("src/lib/sitemap.ts");
  for (const p of ['"/"', '"/guides"', '"/about"', '"/contact"'])
    assert.ok(pages.includes(`path: ${p}`), p);
  assert.doesNotMatch(pages, /agenc|pricing|request-proposals/i);
});

test("never private areas or URLs with a query string, even if passed in", () => {
  for (const path of [
    "/admin",
    "/admin/guides",
    "/login",
    "/auth/callback",
    "/api/cron/guides",
    "/guides?q=seo",
  ])
    assert.equal(sitemapSafe(path), false, path);
  const xml = urlsetXml([{ path: "/" }, { path: "/admin/guides" }], absolute);
  assert.match(xml, /<loc>https:\/\/ytagencies\.com\/<\/loc>/);
  assert.doesNotMatch(xml, /admin/);
});

test("absolute URLs on the apex domain, no lastmod when there's no real date", () => {
  const xml = urlsetXml([{ path: "/about" }], absolute);
  assert.match(xml, /<url><loc>https:\/\/ytagencies\.com\/about<\/loc><\/url>/);
  assert.doesNotMatch(xml, /www\.ytagencies|priority|changefreq/);
});

test("the index lists each child sitemap with its newest date", () => {
  const xml = indexXml([
    { url: "https://ytagencies.com/sitemaps/guides.xml", lastModified: "2026-10-02" },
    { url: "https://ytagencies.com/sitemaps/authors.xml", lastModified: null },
  ]);
  assert.match(xml, /<sitemapindex /);
  assert.match(
    xml,
    /<sitemap><loc>https:\/\/ytagencies\.com\/sitemaps\/guides\.xml<\/loc><lastmod>2026-10-02T00:00:00\.000Z<\/lastmod><\/sitemap>/,
  );
  assert.match(
    xml,
    /<sitemap><loc>https:\/\/ytagencies\.com\/sitemaps\/authors\.xml<\/loc><\/sitemap>/,
  );
});

test("llms.txt: H1, one-line summary, guides and site pages", () => {
  const txt = llmsTxt({
    brand: "YT Agencies",
    summary: "Practical YouTube guides.",
    about: "Guides for businesses and creators.",
    guides: [{ title: "YouTube SEO", url: absolute("/guides/youtube-seo"), note: "Rank videos." }],
    pages: [{ title: "About", url: absolute("/about") }],
  });
  assert.match(txt, /^# YT Agencies\n/);
  assert.match(txt, /\n> Practical YouTube guides\.\n/);
  assert.match(
    txt,
    /\n## Guides\n\n- \[YouTube SEO\]\(https:\/\/ytagencies\.com\/guides\/youtube-seo\): Rank videos\.\n/,
  );
  assert.match(txt, /## About/);
  assert.doesNotMatch(txt, /## (Services|Industries|Locations)/);
});

test("sitemap Cache-Control: short CDN cache, never immutable", () => {
  assert.equal(SITEMAP_CACHE_CONTROL, "public, s-maxage=300, stale-while-revalidate=3600");
  assert.doesNotMatch(SITEMAP_CACHE_CONTROL, /immutable/);
});
