// Guide content (src/lib/guide-content.ts): the Markdown → Tiptap migration, the allowlist
// renderer/sanitizer, and paste cleanup.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cleanPastedHtml,
  docOutline,
  docReadMinutes,
  docToHtml,
  guideBlocks,
  imageSize,
  imagesWithoutAlt,
  looksLikeMarkdown,
  markdownToDoc,
  safeHref,
  sanitizeDoc,
  wordCount,
} from "../src/lib/guide-content.ts";

const STORAGE = "https://x.supabase.co/storage/v1/object/public/guide-media/";
const ours = (src) => src.startsWith(STORAGE);

const SAMPLE = `# What it costs

Agencies charge a **retainer** and *sometimes* a setup fee. See [pricing](/for-agencies/pricing).

## Budget

{{budget-range youtube-ads-agencies}}

### Typical ranges

| Size | Monthly |
| --- | --- |
| Small | $1,000 |
| Large | $10,000 |

- Ads management
- Creative

1. Brief
2. Launch

> [!tip] Start small and scale.

![Dashboard](${STORAGE}a/shot-1200x800.webp)

---
`;

test("migration: headings (H1 → H2), marks, link, table, lists, embed, callout, image", () => {
  const doc = markdownToDoc(SAMPLE);
  const types = doc.content.map((n) => n.type);
  assert.deepEqual(types, [
    "heading",
    "paragraph",
    "heading",
    "embed",
    "heading",
    "table",
    "bulletList",
    "orderedList",
    "blockquote",
    "image",
    "horizontalRule",
  ]);
  assert.equal(doc.content[0].attrs.level, 2, "H1 becomes H2");
  assert.equal(doc.content[4].attrs.level, 3);
  assert.deepEqual(doc.content[3].attrs, { kind: "budget-range", service: "youtube-ads-agencies" });

  const para = doc.content[1].content;
  assert.ok(para.some((t) => t.text === "retainer" && t.marks?.[0].type === "bold"));
  assert.ok(para.some((t) => t.text === "sometimes" && t.marks?.[0].type === "italic"));
  assert.ok(
    para.some((t) =>
      t.marks?.some((m) => m.type === "link" && m.attrs.href === "/for-agencies/pricing"),
    ),
  );

  const table = doc.content[5];
  assert.equal(table.content.length, 3);
  assert.ok(table.content[0].content.every((c) => c.type === "tableHeader"));
  assert.ok(table.content[1].content.every((c) => c.type === "tableCell"));

  const quote = doc.content[8].content[0].content;
  assert.deepEqual(quote[0], { type: "text", text: "Tip: ", marks: [{ type: "bold" }] });
  assert.equal(quote[1].text, "Start small and scale.");

  assert.equal(doc.content[9].attrs.alt, "Dashboard");
});

test("migration output renders to the same structure the public page shows", () => {
  const html = docToHtml(markdownToDoc(SAMPLE), ours);
  assert.match(html, /^<h2>What it costs<\/h2>/);
  assert.match(html, /<div data-embed="budget-range" data-service="youtube-ads-agencies"><\/div>/);
  assert.match(
    html,
    /<table><thead><tr><th>Size<\/th><th>Monthly<\/th><\/tr><\/thead><tbody><tr><td>Small<\/td>/,
  );
  assert.match(html, /<a href="\/for-agencies\/pricing">pricing<\/a>/);
  assert.match(html, new RegExp(`<img src="${STORAGE}a/shot-1200x800.webp" alt="Dashboard">`));
});

test("sanitizer: no scripts, styles, event handlers or javascript: links get through", () => {
  const evil = {
    type: "doc",
    content: [
      { type: "script", content: [{ type: "text", text: "alert(1)" }] },
      {
        type: "paragraph",
        attrs: { style: "color:red", onclick: "x()" },
        content: [
          {
            type: "text",
            text: "<script>alert(1)</script>",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
          {
            type: "text",
            text: " ok",
            marks: [
              { type: "link", attrs: { href: "https://example.com", onmouseover: "x()" } },
              { type: "textStyle", attrs: { color: "red" } },
            ],
          },
        ],
      },
      { type: "image", attrs: { src: "https://evil.example/x.png", alt: "x", onerror: "x()" } },
      { type: "image", attrs: { src: `${STORAGE}ok.png`, alt: "fine", onerror: "x()" } },
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
      { type: "embed", attrs: { kind: "iframe", service: "x" } },
    ],
  };
  const doc = sanitizeDoc(evil, ours);
  const html = docToHtml(doc, ours);
  assert.doesNotMatch(
    html,
    /<script|<style|style=|onclick|onerror|onmouseover|javascript:|iframe|evil\.example|color/i,
  );
  assert.match(
    html,
    /<p>&lt;script&gt;alert\(1\)&lt;\/script&gt;<a href="https:\/\/example\.com\/"> ok<\/a><\/p>/,
  );
  assert.match(html, /<img src="[^"]+ok\.png" alt="fine">/);
  assert.match(html, /<h2>Title<\/h2>/, "H1 is never stored");
});

test("safeHref: http(s), mailto and site-relative only", () => {
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("data:text/html,x"), null);
  assert.equal(safeHref("//evil.com"), null);
  assert.equal(safeHref("/guides"), "/guides");
  assert.equal(safeHref("#budget"), "#budget");
  assert.equal(safeHref("mailto:help@ytagencies.com"), "mailto:help@ytagencies.com");
  assert.equal(safeHref("https://ytagencies.com/x"), "https://ytagencies.com/x");
});

test("paste: Google Docs (bold wrapper, styled spans, fonts, empty lines)", () => {
  const gdocs = `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b"><h1 dir="ltr" style="line-height:1.38"><span style="font-size:20pt;font-family:Arial;color:#000000;font-weight:400">Hiring guide</span></h1><p dir="ltr" style="line-height:1.38"><span style="font-size:11pt;font-family:Arial;font-weight:700">Bold part</span><span style="font-size:11pt;font-family:Arial;font-style:italic"> and italic</span> and <a href="https://ytagencies.com/guides" style="text-decoration:none"><span style="color:#1155cc">a link</span></a></p><p dir="ltr"><span style="font-size:11pt"><br></span></p><ul style="list-style-type:disc"><li dir="ltr" style="font-family:Arial"><p dir="ltr"><span>One</span></p></li></ul></b>`;
  const out = cleanPastedHtml(gdocs);
  assert.equal(
    out,
    `<h2>Hiring guide</h2><p><strong>Bold part</strong><em> and italic</em> and <a href="https://ytagencies.com/guides">a link</a></p><ul><li><p>One</p></li></ul>`,
  );
});

test("paste: Word (mso junk, conditional comments, o:p, classes, &nbsp; spacers)", () => {
  const word = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p.MsoNormal{mso-style-parent:""}</style></head><body><!--[if gte mso 9]><xml><o:OfficeDocumentSettings></o:OfficeDocumentSettings></xml><![endif]--><p class="MsoNormal" style="mso-margin-top-alt:auto"><b><span style="font-family:Calibri;mso-bidi-font-weight:normal">Key point</span></b><o:p></o:p></p><p class="MsoNormal">&nbsp;<o:p></o:p></p><table class="MsoTableGrid" border="1" style="border-collapse:collapse"><tr><td width="200" style="mso-border-alt:solid"><p class="MsoNormal">Cell</p></td></tr></table><p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1.</span>Item</p></body></html>`;
  const out = cleanPastedHtml(word);
  assert.doesNotMatch(out, /mso|class=|style=|o:p|<xml|width=|border=/i);
  assert.match(
    out,
    /^<p><b>Key point<\/b><\/p><table><tbody><tr><td><p>Cell<\/p><\/td><\/tr><\/tbody><\/table><p>Item<\/p>$/,
  );
  assert.doesNotMatch(out, /<p>\s*<\/p>/);
});

test("Markdown pasted as plain text is detected; ordinary text isn't", () => {
  assert.equal(looksLikeMarkdown("## Plan\n\n- one\n- two\n\nSome **bold** text"), true);
  assert.equal(looksLikeMarkdown("Just a normal sentence, nothing special."), false);
});

test("counts, alt warnings and the outline", () => {
  const doc = markdownToDoc(
    `## One\n\n${"word ".repeat(450)}\n\n### Two\n\n![](${STORAGE}x.png)\n\n##### Deep`,
  );
  assert.equal(wordCount(doc), 453); // One + 450 + Two + Deep
  assert.equal(docReadMinutes(doc), 2);
  assert.equal(imagesWithoutAlt(doc), 1);
  assert.deepEqual(
    docOutline(doc).map((h) => [h.level, h.text]),
    [
      [2, "One"],
      [3, "Two"],
    ],
  );
});

test("public page: unique heading ids, outline, embeds split out, image sizes, no raw HTML", () => {
  const { blocks, outline } = guideBlocks(
    markdownToDoc(
      `# Intro

## Costs & fees

### Ad spend

{{budget-range youtube-ads-agencies}}

## Costs & fees

<script>x()</script>`,
    ),
    ours,
  );
  assert.deepEqual(
    outline.map((o) => [o.id, o.depth]),
    [
      ["intro", 2],
      ["costs-fees", 2],
      ["ad-spend", 3],
      ["costs-fees-2", 2],
    ],
  );
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["html", "budget-range", "html"],
  );
  assert.doesNotMatch(JSON.stringify(blocks), /script/);
  assert.deepEqual(imageSize(`${STORAGE}a/b-1200x630.webp`), { width: 1200, height: 630 });
  assert.equal(imageSize("https://x.example/photo.png"), null);
});
