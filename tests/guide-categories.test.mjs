// Guide categories (src/lib/guide-categories.ts): the /guides tabs and "More", empty categories,
// delete rules, slug-change redirects, the one featured guide, and indexing of category and
// search pages.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  canDeleteCategory,
  categoryIndexable,
  categorySlug,
  cleanGuideQuery,
  guideMatches,
  guidesSearchRobots,
  guideTabs,
  pickFeatured,
} from "../src/lib/guide-categories.ts";

const cat = (id, sort_order, show_in_tabs = true) => ({ id, name: id, slug: id, sort_order, show_in_tabs });
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("tabs: at most the limit, in order; the rest go under More", () => {
  const cats = [cat("h", 7), cat("a", 0), cat("b", 1), cat("c", 2), cat("d", 3), cat("e", 4), cat("f", 5), cat("g", 6)];
  const { tabs, more } = guideTabs(cats, () => 2, 6);
  assert.deepEqual(tabs.map((c) => c.id), ["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(more.map((c) => c.id), ["g", "h"]);
  assert.deepEqual(guideTabs(cats, () => 1, 3).tabs.map((c) => c.id), ["a", "b", "c"]);
});

test("tabs: categories not shown as a tab go under More; no More when nothing is left", () => {
  const { tabs, more } = guideTabs([cat("a", 0), cat("b", 1, false)], () => 1, 6);
  assert.deepEqual(tabs.map((c) => c.id), ["a"]);
  assert.deepEqual(more.map((c) => c.id), ["b"]);
  assert.equal(guideTabs([cat("a", 0)], () => 1, 6).more.length, 0);
});

test("categories without live guides appear nowhere", () => {
  const live = { a: 3, b: 0, c: 1 };
  const { tabs, more } = guideTabs([cat("a", 0), cat("b", 1), cat("c", 2, false)], (id) => live[id], 6);
  assert.deepEqual(tabs.map((c) => c.id), ["a"]);
  assert.deepEqual(more.map((c) => c.id), ["c"]);
});

test("delete is blocked while a guide uses the category", () => {
  assert.equal(canDeleteCategory(0), true);
  assert.equal(canDeleteCategory(1), false);
  const src = read("src/lib/actions/admin-guide-categories.ts");
  assert.match(src, /canDeleteCategory\(count \?\? 0\)/);
  assert.match(src, /Move .* to another category first/);
  // The database backs it up: guides.category_id is ON DELETE RESTRICT.
  assert.match(read("supabase/schema.sql"), /category_id uuid references guide_categories\(id\) on delete restrict/);
});

test("a slug change keeps the old URL as a permanent redirect", () => {
  const src = read("src/lib/actions/admin-guide-categories.ts");
  assert.match(src, /before\.slug !== slug[\s\S]*guide_category_redirects[\s\S]*upsert\(\{ from_slug: before\.slug, category_id: id \}\)/);
  const page = read("src/app/(marketing)/guides/category/[slug]/page.tsx");
  assert.match(page, /getCategoryRedirect\(slug\)/);
  assert.match(page, /permanentRedirect\(/);
  assert.equal(categorySlug("Prices & Contracts"), "prices-and-contracts");
  assert.equal(categorySlug("  Café SEO!  "), "cafe-seo");
});

test("only one guide is featured; without one, the latest is", () => {
  assert.match(read("supabase/schema.sql"), /create unique index guides_one_featured on guides \(is_featured\) where is_featured/);
  const src = read("src/lib/actions/admin-guides.ts");
  assert.match(src, /update\(\{ is_featured: false \}\)/);
  const newest = { slug: "new", isFeatured: false };
  const picked = { slug: "old", isFeatured: true };
  assert.equal(pickFeatured([newest, picked]), picked);
  assert.equal(pickFeatured([newest, { slug: "x", isFeatured: false }]), newest);
  assert.equal(pickFeatured([]), null);
});

test("category pages are noindex under 3 live guides", () => {
  assert.equal(categoryIndexable(0), false);
  assert.equal(categoryIndexable(2), false);
  assert.equal(categoryIndexable(3), true);
  assert.match(read("src/lib/sitemap.ts"), /categoryIndexable\(inIt\.length\)/);
});

test("search: noindex,follow with canonical /guides; cleaned to 100 characters", () => {
  assert.deepEqual(guidesSearchRobots("price"), { noindex: true, canonical: "/guides" });
  assert.deepEqual(guidesSearchRobots(""), { noindex: false, canonical: null });
  assert.equal(cleanGuideQuery('  <script>alert("x")</script>  '), "script alert x script");
  assert.equal(cleanGuideQuery("a".repeat(150)).length, 100);
  const g = { title: "What YouTube ads cost", excerpt: null, text: "Retainers start at $2,000." };
  assert.equal(guideMatches(g, "ads retainers"), true);
  assert.equal(guideMatches(g, "ads contracts"), false);
});
