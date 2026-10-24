// Dashboard routes (src/app/dashboard/[slug]). The analytics and Plan pages once looked their agency
// up by id with a slug, so every owner got a 404. These checks keep the nav and the pages in line:
// every nav link has a page, and every page finds its agency the one way (dashboardContext: by
// slug, owner only, 404 otherwise; never a 404 for plan state). Ownership itself is tested against
// the database in supabase/tests/access.mjs ("Dashboard by slug").
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SLUG_DIR = join(ROOT, "src/app/dashboard/[slug]");
const tabs = readFileSync(join(ROOT, "src/components/dashboard/tabs.tsx"), "utf8");

const navSections = [...tabs.matchAll(/href: (?:base|`\$\{base\}(\/[a-z-]+)`)/g)].map(
  (m) => m[1] ?? "",
);

function pages(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? pages(p) : name === "page.tsx" ? [p] : [];
  });
}

test("the nav lists the dashboard sections", () => {
  assert.deepEqual(navSections, [
    "",
    "/inquiries",
    "/profile",
    "/channels",
    "/work-samples",
    "/case-studies",
    "/verification",
    "/analytics",
    "/billing",
    "/badge",
  ]);
});

test("every nav link has a page under /dashboard/[slug]", () => {
  for (const section of navSections)
    assert.ok(
      existsSync(join(SLUG_DIR, section, "page.tsx")),
      `missing page for ${section || "/"}`,
    );
});

test("every dashboard page finds its agency through dashboardContext, by slug", () => {
  for (const file of pages(SLUG_DIR)) {
    const source = readFileSync(file, "utf8");
    const name = file.slice(SLUG_DIR.length);
    if (name.includes("[...rest]")) continue; // the dashboard 404 for unknown sub-pages
    assert.doesNotMatch(source, /getOwnedAgency\(/, `${name}: id lookup with a slug`);
    assert.doesNotMatch(source, /notFound\(\)/, `${name}: 404s on its own`);
    assert.match(source, /dashboardContext\(|<Overview /, `${name}: doesn't use dashboardContext`);
  }
});

test("the dashboard has its own 404 pages and a catch-all for unknown sub-pages", () => {
  for (const f of ["not-found.tsx", "[slug]/not-found.tsx", "[slug]/[...rest]/page.tsx"])
    assert.ok(existsSync(join(ROOT, "src/app/dashboard", f)), f);
});
