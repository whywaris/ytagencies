import type { Element, ElementContent, Root } from "hast";
import type { Blockquote, Root as MdRoot } from "mdast";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

// Guide Markdown → sanitized HTML tree (ADMIN_V2_SPEC §8, SECURITY.md). Shared by the public guide
// pages (server) and the editor preview (browser), so both show exactly the same thing.
// No "@/" imports and no JSX: tests load this file directly. React rendering: markdown-render.tsx.
//
// Safety: raw HTML in the Markdown is dropped (remark-rehype without allowDangerousHtml), and the
// result goes through rehype-sanitize's GitHub schema: no scripts, no event handlers, no
// javascript: links. Besides Markdown there's an allowlisted shortcode line and callouts
// (`> [!tip]`, `> [!note]`, `> [!warning]`), which become <aside> with one of our own classes; the
// sanitizer allows exactly those class values and nothing else. Heading ids are added after
// sanitizing, from the heading text.

/** `{{budget-range <service-slug>}}` alone on a line renders the live budget box. */
const SHORTCODE = /^\{\{budget-range ([a-z0-9-]{1,80})\}\}$/;

export type GuideBlock =
  { kind: "markdown"; tree: Root } | { kind: "budget-range"; service: string };

export const CALLOUTS = ["tip", "note", "warning"] as const;
export type CalloutKind = (typeof CALLOUTS)[number];
const CALLOUT_MARK = /^\[!(tip|note|warning)\]\s*/i;

/** `> [!tip] text` → <aside class="callout callout-tip">text</aside> (marker removed). */
function remarkCallouts() {
  return (tree: MdRoot) => {
    for (const node of tree.children) {
      if (node.type !== "blockquote") continue;
      const first = (node as Blockquote).children[0];
      const text = first?.type === "paragraph" ? first.children[0] : undefined;
      const mark = text?.type === "text" ? text.value.match(CALLOUT_MARK) : null;
      if (!mark || !text || text.type !== "text" || first.type !== "paragraph") continue;
      text.value = text.value.slice(mark[0].length);
      if (!text.value) first.children.shift();
      if (!first.children.length) node.children.shift();
      const kind = mark[1].toLowerCase();
      node.data = { hName: "aside", hProperties: { className: ["callout", `callout-${kind}`] } };
    }
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkCallouts)
  .use(remarkRehype)
  .use(rehypeSanitize, {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), "aside"],
    attributes: {
      ...defaultSchema.attributes,
      aside: [["className", "callout", ...CALLOUTS.map((k) => `callout-${k}`)]],
    },
    protocols: { ...defaultSchema.protocols, src: ["https"] },
  });

export function markdownToTree(md: string): Root {
  return processor.runSync(processor.parse(md)) as Root;
}

export type OutlineItem = { id: string; text: string; depth: 2 | 3 };

export function textOf(node: Root | ElementContent): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map((c) => textOf(c as ElementContent)).join("") : "";
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 60)
    .replace(/-+$/, "") || "section";

/**
 * Gives every h1–h3 a stable id from its text (deduplicated across the whole guide) and returns
 * the table of contents: h2s (and h1s, which render as h2) with their h3s.
 */
function addHeadingIds(blocks: GuideBlock[]): OutlineItem[] {
  const seen = new Map<string, number>();
  const outline: OutlineItem[] = [];
  const walk = (node: Root | Element) => {
    for (const child of node.children) {
      if (child.type !== "element") continue;
      if (/^h[1-3]$/.test(child.tagName)) {
        const text = textOf(child).trim();
        const base = slugify(text);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const id = n ? `${base}-${n + 1}` : base;
        child.properties = { ...child.properties, id };
        outline.push({ id, text, depth: child.tagName === "h3" ? 3 : 2 });
      } else {
        walk(child);
      }
    }
  };
  for (const b of blocks) if (b.kind === "markdown") walk(b.tree);
  return outline;
}

export type TocGroup = { id: string; text: string; children: OutlineItem[] };

/** h2s with their h3s. h3s before the first h2 are dropped (nothing to nest them under). */
export function groupOutline(items: OutlineItem[]): TocGroup[] {
  const groups: TocGroup[] = [];
  for (const item of items) {
    if (item.depth === 2) groups.push({ id: item.id, text: item.text, children: [] });
    else groups.at(-1)?.children.push(item);
  }
  return groups;
}

/** A parsed guide: render blocks plus its table of contents. */
export function parseGuideWithOutline(md: string) {
  const blocks = parseGuide(md);
  return { blocks, outline: addHeadingIds(blocks) };
}

/**
 * Splits a guide into Markdown chunks and shortcode blocks. Shortcode lines inside code fences
 * stay as text.
 */
export function parseGuide(md: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let chunk: string[] = [];
  let inFence = false;
  const flush = () => {
    if (chunk.join("").trim())
      blocks.push({ kind: "markdown", tree: markdownToTree(chunk.join("\n")) });
    chunk = [];
  };
  for (const line of md.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const short = !inFence && line.trim().match(SHORTCODE);
    if (short) {
      flush();
      blocks.push({ kind: "budget-range", service: short[1] });
    } else {
      chunk.push(line);
    }
  }
  flush();
  return blocks;
}

/** Width and height encoded in uploaded image names (`…-1200x800.webp`), for next/image. */
export function imageSize(src: string) {
  const m = src.match(/-(\d{2,5})x(\d{2,5})\.(?:png|jpe?g|webp)$/i);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

/** Minutes to read at 225 words a minute, at least 1. */
export function readMinutes(md: string) {
  const words = plainText(md).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

/** Plain text of a guide, for word counts and fallbacks (shortcodes removed). */
export function plainText(md: string) {
  return md
    .replace(/^\{\{[^}]*\}\}$/gm, "")
    .replace(/[#>*_`~[\]()!|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
