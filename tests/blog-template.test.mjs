// The guide page template (src/components/guides/guide-article.tsx): the navy hero without the
// excerpt, the byline, the cover under the band (alt always set, URL encoded once), the
// Alternatives hero left as it was, and the table of contents and share rail where they were.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { mediaUrl } from "../src/lib/guide-media.ts";
import { bylineDate } from "../src/lib/guide-template.ts";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const article = read("src/components/guides/guide-article.tsx");
const fn = (name) => article.match(new RegExp(`\\nfunction ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

test("the hero: breadcrumb, H1 and byline on navy, no excerpt", () => {
  const hero = fn("GuideHero");
  assert.match(hero, /<header className="bg-navy text-white">/);
  assert.match(hero, /<h1 className="text-display text-balance">\{guide\.title\}<\/h1>/);
  assert.doesNotMatch(hero, /excerpt/);
  // Guides › category; the current page is only in the JSON-LD breadcrumb.
  assert.match(hero, /<span aria-hidden>›<\/span>/);
  assert.doesNotMatch(hero, /aria-current/);
  // Rendered for every template but Alternatives.
  assert.match(article, /\{!alternatives && <GuideHero guide=\{guide\} category=\{category\} \/>\}/);
});

test("byline: avatar, \"Written by\" and the date apart, never run together", () => {
  const hero = fn("GuideHero");
  // The initials are decorative, so "WJ" never runs into the name.
  assert.match(read("src/components/guides/guide-parts.tsx"), /<span aria-hidden>\{initials\(author\.name\)\}<\/span>/);
  assert.match(hero, /Written by\{" "\}\s*<Link\s+href=\{`\/authors\/\$\{guide\.author\.slug\}`\}\s+className="[^"]*underline/);
  // The date is its own line, with no read time glued to it.
  assert.match(hero, /<p>\s*Last updated on <time dateTime=\{guide\.updatedAt\}>\{bylineDate\(guide\.updatedAt\)\}<\/time>\s*<\/p>/);
  assert.doesNotMatch(hero, /readMinutes/);
  assert.equal(bylineDate("2026-10-25T09:00:00Z"), "Oct. 25, 2026");
  assert.equal(bylineDate("2026-05-03T23:59:00Z"), "May 3, 2026");
  assert.equal(bylineDate("2026-01-01T00:00:00Z"), "Jan. 1, 2026");
});

test("cover: under the band, alt from cover_alt else the title", () => {
  assert.match(article, /alt=\{guide\.coverAlt\?\.trim\(\) \|\| guide\.title\}/);
  assert.match(article, /className="max-w-reading min-\[1100px\]:col-start-2"/);
});

test("cover URLs are percent-encoded exactly once", () => {
  const encoded = "https://media.ytagencies.com/Blogs/Talent%20Agencies%20for%20New%20YouTubers.png.webp";
  assert.equal(mediaUrl(encoded), encoded);
  assert.equal(mediaUrl("https://media.ytagencies.com/Blogs/Talent Agencies for New YouTubers.png.webp"), encoded);
  assert.equal(mediaUrl("https://media.ytagencies.com/a/plain.webp?v=2"), "https://media.ytagencies.com/a/plain.webp?v=2");
  assert.doesNotMatch(mediaUrl("https://media.ytagencies.com/My Cover (1).webp"), /%25/);
  assert.match(mediaUrl("guides/my cover.webp"), /\/agency-media\/guides\/my%20cover\.webp$/);
  assert.match(mediaUrl("guides/my%20cover.webp"), /\/agency-media\/guides\/my%20cover\.webp$/);
  // Everything goes through it.
  assert.match(read("src/lib/data/guides.ts"), /export \{ mediaUrl \} from "@\/lib\/guide-media";/);
});

test("the Alternatives hero is unchanged", () => {
  const sha = createHash("sha256").update(fn("AlternativesHeader").slice(1)).digest("hex");
  assert.equal(sha, "4f63b4707fb567201938244ca0b1f753305284c3bed3743895b93e7814299318");
});

test("table of contents (left) and share rail (right) stay where they were", () => {
  const snapshot = [
    `<aside className="hidden min-[1100px]:col-start-1 min-[1100px]:row-start-2 min-[1100px]:block print:hidden">`,
    `<div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pt-12">`,
    `<TocPanel groups={groups} numbered={numbered} className="mt-8" />`,
    `<aside className="hidden min-[1100px]:col-start-3 min-[1100px]:row-start-2 min-[1100px]:block">`,
    `<div className="sticky top-20 pt-12">`,
    `<ShareBar url={shareUrl} title={guide.title} variant="rail" />`,
    `className="mx-auto grid max-w-content grid-cols-1 px-4 pt-8 pb-20 min-[1100px]:grid-cols-[200px_minmax(0,680px)_40px] min-[1100px]:justify-center min-[1100px]:gap-x-12 md:px-6 md:pt-12"`,
  ];
  for (const line of snapshot) assert.ok(article.includes(line), line);
});

test("only the article's sections are headings; one TOC and one share block at a time", () => {
  assert.doesNotMatch(read("src/components/guides/guide-parts.tsx"), /id="about-author"|<h2/);
  const share = read("src/components/guides/share-bar.tsx");
  assert.doesNotMatch(share, /<h[1-6]/);
  // display: none removes the hidden copy from the accessibility tree.
  assert.match(article, /variant="row"\s+className="mt-12 min-\[1100px\]:hidden"/);
  assert.match(read("src/components/toc-panel.tsx"), /min-\[1100px\]:hidden/);
});

test("content styles: the lead, headings, tables and bold", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /\.guide-content > p:first-child \{\n {2}@apply [^;]*md:text-\[21px\]/);
  assert.match(css, /\.guide-content h3:not\(\.guide-block \*\) \{\n {2}@apply [^;]*md:text-\[22px\]/);
  assert.match(css, /\.guide-content strong:not\(\.guide-block \*\) \{\n {2}@apply font-semibold text-text;/);
  assert.match(css, /\.guide-content th:not\(\.guide-block \*\) \{\n {2}@apply border border-line bg-surface/);
  // Key takeaways go right after the lead, only when filled in.
  assert.match(article, /const takeaways = guide\.keyTakeaways\.length > 0 && \(/);
  assert.match(article, /afterLead=\{alternatives \? undefined : takeaways\}/);
});
