// Keeping Vercel usage down: page ISR times, the shared agency list's cache, what a change refreshes,
// what's prerendered at build time and which commits deploy.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const ttl = (p) => Number(read(p).match(/export const revalidate = (\d+);/)?.[1]);
const M = "src/app/(marketing)";
const DIRECTORY = [
  `${M}/[service]/page.tsx`,
  `${M}/[service]/[segment]/page.tsx`,
  `${M}/[service]/[segment]/[location]/page.tsx`,
  `${M}/industries/[industry]/page.tsx`,
  `${M}/locations/[country]/page.tsx`,
  `${M}/locations/[country]/[city]/page.tsx`,
];

test("the shared agency list never shortens a page's ISR time", () => {
  // unstable_cache lowers the page's revalidate to its own: 60 seconds here rebuilt 254 pages a minute.
  const browse = read("src/lib/data/browse.ts");
  const pool = Number(browse.match(/\["browse-pool"\],\n\s+\{ revalidate: (\d+), tags: \["browse-pool"\] \}/)?.[1]);
  for (const p of [...DIRECTORY, `${M}/agency/[slug]/page.tsx`, `${M}/guides/[slug]/page.tsx`])
    assert.ok(pool >= ttl(p), `${p}: ${ttl(p)} > pool ${pool}`);
  for (const p of DIRECTORY) assert.equal(ttl(p), 21600, p);
  assert.equal(ttl(`${M}/agency/[slug]/page.tsx`), 86400);
});

test("only a change to where an agency is listed or how it ranks refreshes the whole directory", () => {
  const body = (name) => {
    const s = read("src/lib/revalidate.ts");
    return s.slice(s.indexOf(`export function ${name}(`)).split("\n}\n")[0];
  };
  const own = body("revalidateAgency");
  assert.match(own, /\/agency\/\$\{slug\}/);
  assert.match(own, /\/og\/agency\/\$\{slug\}/);
  assert.match(own, /revalidateSitemap\("agencies"\)/); // a fixed thin profile is indexable at once
  assert.doesNotMatch(own, /\[service\]|\[industry\]|\[country\]|browse-pool/);

  const all = body("revalidateAgencyListings");
  for (const p of ["[service]/[segment]/[location]", "industries/[industry]", "locations/[country]/[city]", "/agencies"])
    assert.ok(all.includes(p), p);
  // Cleared immediately, or the pages would rebuild from a stale copy and keep it for hours.
  assert.match(all, /revalidateTag\("browse-pool", \{ expire: 0 \}\)/);

  // Each of these changes where an agency shows or how it ranks.
  const fn = (file, name) => {
    const s = read(file);
    return s.slice(s.indexOf(`export async function ${name}(`)).split("\n}\n")[0];
  };
  const D = "src/lib/actions/admin-directory.ts";
  for (const name of ["setAgenciesStatus", "deleteAgencies", "changePlan", "decideSubmission", "saveVerification", "revokeVerification"])
    assert.match(fn(D, name), /revalidateAgencyListings\(/, name);
  assert.match(fn("src/lib/actions/dashboard.ts", "updateProfile"), /revalidateAgencyListings\(/);
  assert.match(fn("src/lib/actions/admin.ts", "adminUpdateProfile"), /revalidateAgencyListings\(/);
  assert.match(read("src/lib/billing/lemonsqueezy.ts"), /revalidateAgencyListings\(agency\.data\.slug\)/);
  // These only show on the profile.
  assert.match(fn(D, "adminSaveCaseStudy"), /revalidateAgency\(/);
  assert.match(fn("src/lib/actions/dashboard.ts", "uploadLogo"), /revalidateAgency\(/);
});

test("only indexable profiles are prerendered; thin ones render on their first visit", () => {
  const page = read(`${M}/agency/[slug]/page.tsx`);
  assert.match(page, /\(await getAgencySlugs\(\)\)\.filter\(\(a\) => a\.indexable\)/);
  assert.doesNotMatch(page, /dynamicParams = false/);
});

test("docs-only commits and bot branches don't deploy", () => {
  const { ignoreCommand } = JSON.parse(read("vercel.json"));
  assert.ok(ignoreCommand.length <= 256, "Vercel's limit");
  assert.match(ignoreCommand, /dependabot\/\*\|claude\/\*\) exit 0/);
  // Against the last deployed commit, so code followed by a docs commit in one push still deploys.
  assert.match(ignoreCommand, /\$\{VERCEL_GIT_PREVIOUS_SHA:-HEAD\^\} HEAD/);
  for (const dir of ["docs", "tests", "e2e", "scripts", "supabase", ".github", "*.md"])
    assert.ok(ignoreCommand.includes(`':!${dir}'`), dir);
  // Anything that ships stays in: src and public aren't excluded.
  assert.doesNotMatch(ignoreCommand, /:!(src|public)/);
  assert.match(ignoreCommand, /\|\| exit 1$/); // any git failure builds rather than skips
});
