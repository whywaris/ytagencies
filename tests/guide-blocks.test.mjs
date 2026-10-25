// Guide blocks and the editor redesign (src/lib/guide-blocks.ts, src/lib/guide-content.ts,
// src/lib/guide-template.ts): blocks survive save → reload unchanged, the editor and the page render
// with the same components and stylesheet, the sanitizer keeps only each block's own fields, FAQ
// schema appears once, publishing needs a category (and, for Alternatives, the prices date), and
// guides written before the blocks render exactly as they did.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  BLOCK_TYPES,
  BLOCKS,
  blockText,
  comparisonItems,
  externalUrl,
  faqItems,
  internalUrl,
  placeholdersIn,
  sanitizeBlock,
} from "../src/lib/guide-blocks.ts";
import { docText, docToHtml, guideBlocks, markdownToDoc, sanitizeDoc, wordCount } from "../src/lib/guide-content.ts";
import { prePublishChecks, shortTitle } from "../src/lib/guide-template.ts";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const noImages = () => false;
const media = (src) => src.startsWith("https://x.supabase.co/storage/v1/object/public/guide-media/");

// A filled-in example of every block, as the editor saves it.
const FILLED = {
  comparisonTable: { rows: [{ name: "YT Agencies", bestFor: "YouTube teams", price: "Free", difference: "Agencies", anchor: "yt-agencies" }], highlightFirst: true },
  productCard: {
    badge: "BEST FOR YOUTUBE SPECIALISTS",
    title: "YT Agencies",
    description: "A directory.\n\nOurs.",
    points: [{ kind: "good", text: "Free" }, { kind: "caveat", text: "Agencies only" }],
    image: "https://x.supabase.co/storage/v1/object/public/guide-media/g/shot-1200x800.webp",
    imageAlt: "The directory",
    caption: "Agencies side by side",
    price: "Free",
    priceSource: "https://example.com/pricing",
    ctaLabel: "Browse agencies",
    ctaHref: "/agencies",
    chooseIf: "you want a team.",
    ours: true,
  },
  abTable: { aLabel: "Fiverr", bLabel: "YT Agencies", rows: [{ label: "Who", a: "Freelancers", b: "Agencies" }], bBetter: "Ongoing work." },
  prosCons: { good: ["Fast"], watch: ["Varies"] },
  faq: { items: [{ q: "Is it free?", a: "Yes." }] },
  ctaBox: { heading: "Compare", lines: ["One", "Two"], primaryLabel: "Browse", primaryHref: "/agencies", secondaryLabel: "Ask", secondaryHref: "/request-proposals" },
  directoryStats: { service: "youtube-ads-agencies" },
};

test("every block type has a definition, an empty value and a filled example", () => {
  assert.deepEqual(Object.keys(BLOCKS).sort(), [...BLOCK_TYPES].sort());
  for (const type of BLOCK_TYPES) {
    assert.ok(FILLED[type], type);
    // The empty value is already clean.
    assert.deepEqual(sanitizeBlock(type, BLOCKS[type].empty(), media), BLOCKS[type].empty(), type);
  }
});

test("each block round-trips: save → reload → identical", () => {
  for (const type of BLOCK_TYPES) {
    const doc = { type: "doc", content: [{ type, attrs: FILLED[type] }] };
    const saved = sanitizeDoc(doc, media);
    // What the server stores, read back as JSON, is what was typed…
    const reloaded = JSON.parse(JSON.stringify(saved));
    assert.deepEqual(reloaded.content[0].attrs, FILLED[type], type);
    // …and saving it again changes nothing.
    assert.deepEqual(sanitizeDoc(reloaded, media), saved, type);
  }
});

test("the sanitizer keeps only each block's own fields, and refuses scripts and bad links", () => {
  const dirty = {
    ...FILLED.productCard,
    title: '<script>alert("x")</script>',
    onclick: "alert(1)",
    style: "color:red",
    extra: { nested: true },
    ctaHref: "javascript:alert(1)",
    priceSource: "javascript:alert(1)",
    image: "https://evil.example/x.png",
    points: [{ kind: "evil", text: "ok", onerror: "x" }],
  };
  const clean = sanitizeBlock("productCard", dirty, media);
  assert.deepEqual(Object.keys(clean).sort(), BLOCKS.productCard.fields.map((f) => f.key).sort());
  assert.equal(clean.ctaHref, "");
  assert.equal(clean.priceSource, "");
  assert.equal(clean.image, "");
  assert.deepEqual(clean.points, [{ kind: "good", text: "ok" }]);
  // Text stays text: the stored HTML escapes it, and the page renders it with React.
  const html = docToHtml(sanitizeDoc({ type: "doc", content: [{ type: "productCard", attrs: dirty }] }, media), media);
  assert.doesNotMatch(html, /<script|onclick|onerror|javascript:/i);
  assert.match(html, /&lt;script&gt;/);
  // Buttons only link within the site; sources only to http(s).
  for (const bad of ["//evil.example", "https://evil.example", "javascript:x", " /ok", "/a b"]) assert.equal(internalUrl(bad), bad === " /ok" ? "/ok" : "", bad);
  assert.equal(internalUrl("/request-proposals?service=x#y"), "/request-proposals?service=x#y");
  for (const bad of ["javascript:alert(1)", "mailto:a@b.c", "/relative", "https://u:p@x.com"]) assert.equal(externalUrl(bad), "", bad);
  // Unknown node types still go.
  assert.deepEqual(sanitizeDoc({ type: "doc", content: [{ type: "iframe", attrs: { src: "x" } }] }, media).content, [{ type: "paragraph" }]);
});

test("the editor and the page render blocks with the same components and stylesheet", () => {
  const node = read("src/components/admin/guide-block-node.tsx");
  const body = read("src/components/guide-body.tsx");
  assert.match(node, /import \{ GuideBlockView, type DirectoryStatsData \} from "@\/components\/guide-blocks";/);
  assert.match(body, /import \{ GuideBlockView, OUTSIDE_REL, type DirectoryStatsData \} from "@\/components\/guide-blocks";/);
  assert.match(node, /<GuideBlockView type=\{type\} attrs=\{attrs\}/);
  // One stylesheet: the editor canvas and the page body both use .guide-content.
  assert.match(read("src/components/admin/rich-editor.tsx"), /class: "guide-content /);
  assert.match(body, /<div className="guide-content">/);
  assert.doesNotMatch(read("src/app/globals.css"), /\.guide-prose/);
  // Element classes live in the stylesheet, not in the page's components.
  assert.doesNotMatch(body, /className="mb-6 list-disc|className="mt-16 mb-4/);
});

test("product cards get section ids the comparison table links to, numbered in order", () => {
  const doc = sanitizeDoc(
    {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Upwork" }] },
        { type: "comparisonTable", attrs: { rows: [{ name: "Upwork", anchor: "upwork-2" }] } },
        { type: "productCard", attrs: { ...FILLED.productCard, title: "YT Agencies" } },
        { type: "productCard", attrs: { ...FILLED.productCard, title: "Upwork", ours: false } },
      ],
    },
    media,
  );
  const { blocks, outline } = guideBlocks(doc, media);
  const cards = blocks.filter((b) => b.kind === "block" && b.type === "productCard");
  assert.deepEqual(cards.map((c) => [c.id, c.number]), [["yt-agencies", 1], ["upwork-2", 2]]);
  assert.deepEqual(outline.map((o) => o.id), ["upwork", "yt-agencies", "upwork-2"]);
  assert.equal(comparisonItems(doc.content)[0].anchor, "upwork-2");
});

test("FAQ schema: every FAQ block's questions, emitted once per page", () => {
  const nodes = [
    { type: "faq", attrs: { items: [{ q: "A?", a: "1" }, { q: "", a: "ignored" }] } },
    { type: "paragraph" },
    { type: "faq", attrs: { items: [{ q: "B?", a: "2" }] } },
  ];
  assert.deepEqual(faqItems(nodes), [
    { question: "A?", answer: "1" },
    { question: "B?", answer: "2" },
  ]);
  const page = read("src/app/(marketing)/guides/[slug]/page.tsx");
  assert.equal((page.match(/faqJsonLd\(/g) ?? []).length, 1);
  assert.match(page, /\{faqs\.length > 0 && <JsonLd data=\{faqJsonLd\(faqs\)\} \/>\}/);
});

test("publishing: blocked without a category, and Alternatives without the prices date", () => {
  const base = {
    categoryId: "c1",
    categorySlug: "pricing",
    excerpt: "An excerpt",
    coverPath: null,
    coverAlt: "",
    seoDescription: "A description",
    pricesCheckedOn: null,
    hasText: true,
    imagesWithoutAlt: 0,
    placeholders: 0,
  };
  const blocking = (i) => prePublishChecks(i).filter((c) => c.blocking).map((c) => c.key);
  assert.deepEqual(blocking(base), []);
  assert.deepEqual(blocking({ ...base, categoryId: null, categorySlug: null }), ["category"]);
  assert.deepEqual(blocking({ ...base, categorySlug: "alternatives" }), ["prices"]);
  assert.deepEqual(blocking({ ...base, categorySlug: "alternatives", pricesCheckedOn: "2026-10-24" }), []);
  // Warnings link to their panels and don't block.
  const warnings = prePublishChecks({ ...base, excerpt: "", coverPath: "guides/x.webp", seoDescription: "", placeholders: 3 });
  assert.deepEqual(warnings.map((c) => [c.key, c.panel, c.blocking]), [
    ["excerpt", "excerpt", false],
    ["cover-alt", "cover", false],
    ["seo-description", "seo", false],
    ["placeholders", "content", false],
  ]);
  // The server runs the same check before publishing.
  assert.match(read("src/lib/actions/admin-guides.ts"), /const blocking = prePublishChecks\(\{/);
  assert.equal(shortTitle("5 Best Fiverr Alternatives for Hiring a YouTube Editor in 2026"), "Fiverr alternatives");
});

test("old guides render unchanged", () => {
  const f = JSON.parse(read("tests/fixtures/legacy-guide.json"));
  const doc = sanitizeDoc(markdownToDoc(f.md), noImages);
  assert.deepEqual(doc, f.doc);
  assert.equal(docToHtml(doc, noImages), f.html);
  const { blocks, outline } = guideBlocks(doc, noImages);
  assert.deepEqual(outline, f.outline);
  assert.deepEqual(blocks.map((b) => b.kind), f.blockKinds);
  assert.equal(wordCount(doc), f.words);
});

test("the example Alternatives guide uses every block and passes the sanitizer as is", () => {
  const sql = read("supabase/migrations/20261103000100_guide_blocks_alternatives.sql");
  const doc = JSON.parse(sql.match(/\$doc\$(.*)\$doc\$::jsonb/s)[1]);
  assert.deepEqual(sanitizeDoc(doc, noImages), doc);
  const types = new Set(doc.content.map((n) => n.type));
  for (const t of BLOCK_TYPES) assert.ok(types.has(t), t);
  assert.match(sql, /'draft',\s*\n\s*\(select id from guide_categories where slug = 'alternatives'\)/);
  // No invented competitor numbers: placeholders instead.
  assert.ok(placeholdersIn(docText(doc)).length >= 10);
  for (const n of doc.content.filter((x) => x.type === "productCard" && !x.attrs.ours))
    assert.match(n.attrs.price, /^\[/, n.attrs.title);
  // Every comparison row links to a product card on the page.
  const ids = guideBlocks(doc, noImages).blocks.filter((b) => b.kind === "block" && b.type === "productCard").map((b) => b.id);
  assert.deepEqual(comparisonItems(doc.content).map((c) => c.anchor), ids);
  assert.ok(blockText("faq", doc.content.find((n) => n.type === "faq").attrs).includes("Is YT Agencies free?"));
});
