// Guide Markdown rendering and sanitizing (src/lib/markdown.ts, SECURITY.md "Guides").
import assert from "node:assert/strict";
import { test } from "node:test";

import { imageSize, markdownToTree, parseGuide } from "../src/lib/markdown.ts";

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
