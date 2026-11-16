// The site is a blog: guides, author bio and site pages no longer describe a directory.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { docText, sanitizeDoc } from "../src/lib/guide-content.ts";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const sql = read("supabase/migrations/20261117000100_blog_copy.sql");
const docs = [
  ...sql.matchAll(/-- ([a-z0-9-]+)\nupdate guides set\n  body_json = \$g\$(\{.*?\})\$g\$::jsonb/gs),
].map((m) => [m[1], JSON.parse(m[2])]);
const DIRECTORY =
  /on YT Agencies|YT Agencies lists|listed on YT Agencies|agencies listed|request proposals|up to three (matching )?agencies|starting prices? on (every|its) profile|independent directory|YT Agencies directory/i;

test("the guides no longer describe the directory or link to it", () => {
  assert.ok(docs.length >= 15, `${docs.length} guides`);
  for (const [slug, doc] of docs) {
    assert.deepEqual(
      sanitizeDoc(doc, () => false),
      doc,
      slug,
    );
    assert.doesNotMatch(docText(doc), DIRECTORY, slug);
    assert.doesNotMatch(
      JSON.stringify(doc),
      /ytagencies\.com\/(agency\/|agencies\b|[a-z0-9-]+-agencies\b|request-proposals|pricing|list-your-agency)/,
      slug,
    );
  }
  // Every guide is only changed while it still holds its original wording.
  assert.equal(
    sql.match(/^update guides set/gm).length,
    sql.match(/\n  and body_json::text (not )?like '/g).length,
  );
});

test("the agency price tables taken from the directory are gone", () => {
  for (const [slug, doc] of docs.filter(([s]) => /agency-cost$/.test(s)))
    assert.doesNotMatch(docText(doc), /Vireo Video|Roasbeast|Voy Media|NoGood/, slug);
});

test("named sources link to their official pages", () => {
  const all = JSON.stringify(Object.fromEntries(docs));
  for (const href of [
    "https://www.getcredo.com/guide/digital-marketing-industry-pricing-survey/ppc-pricing/",
    "https://www.webfx.com/social-media/pricing/how-much-does-youtube-advertising-cost",
    "https://clutch.co/agencies/ppc/youtube",
    "https://www.ftc.gov/business-guidance/blog/2019/11/youtube-channel-owners-your-content-directed-children",
    "https://support.google.com/youtube/answer/3056283",
  ])
    assert.ok(all.includes(href), href);
});

test("the author bio and site pages read as a blog", () => {
  assert.match(
    sql,
    /update authors set bio = \$g\$Waris Jamil is a freelancer from Multan, Pakistan/,
  );
  for (const p of ["about", "terms", "privacy", "editorial-policy", "disclaimer", "cookies"]) {
    const page = read(`src/app/(marketing)/${p}/page.tsx`);
    assert.doesNotMatch(
      page,
      /independent directory|compare agencies|request proposals|\bPro plan\b|sponsored place|refund/i,
      p,
    );
  }
  assert.match(
    read("src/components/footer.tsx"),
    /\{ href: "\/disclaimer", label: "Disclaimer" \}/,
  );
  assert.match(read("src/lib/page-dates.ts"), /"\/disclaimer": "\d{4}-\d{2}-\d{2}"/);
  assert.match(
    read("src/app/(marketing)/privacy/page.tsx"),
    /DoubleClick cookie[\s\S]*aboutads\.info[\s\S]*California Consumer Privacy Act/,
  );
  assert.match(read("src/lib/indexing.ts"), /allow: \["\/", "\/_next\/image", "\/guides\?page="\]/);
});
