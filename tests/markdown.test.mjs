// Guide Markdown rendering and sanitizing (src/lib/markdown.ts, SECURITY.md "Guides").
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  imageSize,
  markdownToTree,
  parseGuide,
  parseGuideWithOutline,
  readMinutes,
} from "../src/lib/markdown.ts";

// Every element and attribute in a tree, flattened for assertions.
function walk(node, out = []) {
  if (node.type === "element") out.push(node);
  for (const child of node.children ?? []) walk(child, out);
  return out;
}
const tags = (md) => walk(markdownToTree(md)).map((e) => e.tagName);

test("Markdown basics render, including GFM tables", () => {
  const t = tags(
    "## Heading\n\nSome **bold** and a [link](/guides).\n\n| a | b |\n|---|---|\n| 1 | 2 |",
  );
  for (const tag of ["h2", "strong", "a", "table", "td"]) assert.ok(t.includes(tag), tag);
});

test("raw HTML and scripts are dropped", () => {
  const t = tags(
    'Hello <script>alert(1)</script> <iframe src="https://evil.example"></iframe> <b onclick="x()">b</b>',
  );
  assert.ok(!t.includes("script") && !t.includes("iframe"));
  assert.ok(!JSON.stringify(markdownToTree("<img src=x onerror=alert(1)>")).includes("onerror"));
});

test("javascript: and data: links are removed, http(s) and relative links kept", () => {
  const links = walk(
    markdownToTree(
      "[a](javascript:alert(1)) [b](data:text/html,x) [c](https://example.com) [d](/x)",
    ),
  ).filter((e) => e.tagName === "a");
  const hrefs = links.map((a) => a.properties.href);
  assert.deepEqual(hrefs.filter(Boolean), ["https://example.com", "/x"]);
});

test("images only over https", () => {
  const imgs = walk(
    markdownToTree("![a](http://x.example/a.png) ![b](https://x.example/b.png)"),
  ).filter((e) => e.tagName === "img");
  assert.deepEqual(
    imgs.map((i) => i.properties.src ?? null),
    [null, "https://x.example/b.png"],
  );
});

test("the budget-range shortcode becomes a block; anything else stays text", () => {
  const blocks = parseGuide(
    "Intro\n\n{{budget-range youtube-ads-agencies}}\n\nMore\n\n{{evil thing}}\n\n```\n{{budget-range in-code}}\n```",
  );
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["markdown", "budget-range", "markdown"],
  );
  assert.equal(blocks[1].service, "youtube-ads-agencies");
  const rest = JSON.stringify(blocks[2].tree);
  assert.ok(rest.includes("{{evil thing}}") && rest.includes("{{budget-range in-code}}"));
});

test("image sizes come from uploaded file names", () => {
  assert.deepEqual(
    imageSize(
      "https://x.supabase.co/storage/v1/object/public/agency-media/guides/a/b-1200x630.webp",
    ),
    { width: 1200, height: 630 },
  );
  assert.equal(imageSize("https://x.example/photo.png"), null);
});

test("callouts become an aside with one of our classes, marker removed", () => {
  for (const kind of ["tip", "note", "warning"]) {
    const aside = walk(markdownToTree(`> [!${kind.toUpperCase()}] Check the contract.`)).find(
      (e) => e.tagName === "aside",
    );
    assert.ok(aside, kind);
    assert.deepEqual(aside.properties.className, ["callout", `callout-${kind}`]);
    assert.ok(!JSON.stringify(aside).includes("[!"), "marker removed");
  }
  // Unknown kinds stay plain blockquotes.
  assert.ok(tags("> [!danger] Nope.").includes("blockquote"));
  assert.ok(!tags("> [!danger] Nope.").includes("aside"));
});

test("raw HTML can't fake a callout or add classes", () => {
  const t = walk(
    markdownToTree('<aside class="callout callout-tip">x</aside>\n\n<p class="evil">y</p>'),
  );
  assert.ok(!t.some((e) => e.tagName === "aside"));
  assert.ok(!t.some((e) => e.properties?.className));
});

test("headings get stable, unique ids and form the outline", () => {
  const { blocks, outline } = parseGuideWithOutline(
    "# Intro\n\n## Costs & fees\n\n### Ad spend\n\n{{budget-range youtube-ads-agencies}}\n\n## Costs & fees\n\n### Ad spend",
  );
  assert.deepEqual(outline, [
    { id: "intro", text: "Intro", depth: 2 },
    { id: "costs-fees", text: "Costs & fees", depth: 2 },
    { id: "ad-spend", text: "Ad spend", depth: 3 },
    { id: "costs-fees-2", text: "Costs & fees", depth: 2 },
    { id: "ad-spend-2", text: "Ad spend", depth: 3 },
  ]);
  const ids = blocks
    .flatMap((b) => (b.kind === "markdown" ? walk(b.tree) : []))
    .map((e) => e.properties?.id)
    .filter(Boolean);
  assert.deepEqual(ids, ["intro", "costs-fees", "ad-spend", "costs-fees-2", "ad-spend-2"]);
});

test("readMinutes: about 225 words a minute, at least 1", () => {
  assert.equal(readMinutes("A few words."), 1);
  assert.equal(readMinutes(Array(1125).fill("word").join(" ")), 5);
  assert.equal(readMinutes("{{budget-range x}}\n\n" + Array(450).fill("w").join(" ")), 2);
});
