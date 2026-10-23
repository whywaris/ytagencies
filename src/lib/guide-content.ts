import type { Element, ElementContent, Root, RootContent } from "hast";
import type { PhrasingContent, Root as MdRoot, RootContent as MdContent } from "mdast";
import rehypeParse from "rehype-parse";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

// Guide content (ADMIN_V2_SPEC §8, SECURITY.md). The source of truth is Tiptap JSON; everything
// public is rendered from it on the server through ONE allowlist (docToHast): only the nodes,
// marks and attributes below get out, text is escaped, links are http(s)/mailto/relative only,
// images only from our storage. No editor code runs on public pages.
// No "@/" imports and no JSX: tests load this file directly.

// ───────── The model ─────────

export type Mark = { type: string; attrs?: Record<string, unknown> };
export type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  marks?: Mark[];
  text?: string;
};
export type Doc = { type: "doc"; content: Node[] };

/** Shortcode embeds the renderer understands (`{{budget-range <service>}}` in old Markdown). */
export const EMBED_KINDS = ["budget-range"] as const;
export type EmbedKind = (typeof EMBED_KINDS)[number];

export const emptyDoc = (): Doc => ({ type: "doc", content: [{ type: "paragraph" }] });
const SLUG = /^[a-z0-9-]{1,80}$/;

// ───────── Markdown → JSON (the one-off migration, and Markdown pasted as plain text) ─────────

const SHORTCODE = /^\{\{(budget-range) ([a-z0-9-]{1,80})\}\}$/;
const CALLOUT = /^\[!(tip|note|warning)\]\s*/i;
const mdParser = unified().use(remarkParse).use(remarkGfm);

const text = (value: string, marks: Mark[] = []): Node =>
  marks.length ? { type: "text", text: value, marks } : { type: "text", text: value };

function inline(nodes: PhrasingContent[], marks: Mark[] = []): Node[] {
  const out: Node[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case "text":
        if (n.value) out.push(text(n.value, marks));
        break;
      case "strong":
        out.push(...inline(n.children, [...marks, { type: "bold" }]));
        break;
      case "emphasis":
        out.push(...inline(n.children, [...marks, { type: "italic" }]));
        break;
      case "delete":
        out.push(...inline(n.children, [...marks, { type: "strike" }]));
        break;
      case "inlineCode":
        out.push(text(n.value, [...marks, { type: "code" }]));
        break;
      case "link":
        out.push(...inline(n.children, [...marks, { type: "link", attrs: { href: n.url } }]));
        break;
      case "break":
        out.push({ type: "hardBreak" });
        break;
      default:
        if ("children" in n) out.push(...inline(n.children as PhrasingContent[], marks));
        else if ("value" in n && typeof n.value === "string") out.push(text(n.value, marks));
    }
  }
  return out;
}

/** A paragraph's images become their own image blocks (images are block-level in the editor). */
function paragraph(children: PhrasingContent[]): Node[] {
  const blocks: Node[] = [];
  let run: PhrasingContent[] = [];
  const flush = () => {
    const content = inline(run);
    if (content.some((c) => c.type !== "text" || c.text?.trim()))
      blocks.push({ type: "paragraph", content });
    run = [];
  };
  for (const c of children) {
    if (c.type === "image") {
      flush();
      blocks.push({
        type: "image",
        attrs: { src: c.url, alt: c.alt ?? "", title: c.title ?? null },
      });
    } else run.push(c);
  }
  flush();
  return blocks;
}

function blocks(nodes: MdContent[]): Node[] {
  const out: Node[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case "heading":
        // H1 is the guide title: any other H1 becomes an H2.
        out.push({
          type: "heading",
          attrs: { level: Math.min(Math.max(n.depth, 2), 6) },
          content: inline(n.children),
        });
        break;
      case "paragraph": {
        const only =
          n.children.length === 1 && n.children[0].type === "text"
            ? n.children[0].value.trim()
            : "";
        const short = only.match(SHORTCODE);
        if (short) out.push({ type: "embed", attrs: { kind: short[1], service: short[2] } });
        else out.push(...paragraph(n.children));
        break;
      }
      case "list":
        out.push({
          type: n.ordered ? "orderedList" : "bulletList",
          ...(n.ordered && n.start && n.start !== 1 ? { attrs: { start: n.start } } : {}),
          content: n.children.map((li) => {
            const content = blocks(li.children as MdContent[]);
            return {
              type: "listItem",
              content: content.length ? content : [{ type: "paragraph" }],
            };
          }),
        });
        break;
      case "blockquote": {
        const content = blocks(n.children as MdContent[]);
        // Old callouts (> [!tip] …) keep their label as bold text in a quote.
        const first = content[0]?.content?.[0];
        const mark = first?.type === "text" ? first.text?.match(CALLOUT) : null;
        if (mark && first) {
          const label = mark[1][0].toUpperCase() + mark[1].slice(1).toLowerCase();
          const rest = first.text!.slice(mark[0].length);
          const others = content[0].content!.slice(1);
          content[0].content = [
            text(`${label}: `, [{ type: "bold" }]),
            ...(rest ? [{ ...first, text: rest }] : []),
            ...others,
          ];
        }
        out.push({
          type: "blockquote",
          content: content.length ? content : [{ type: "paragraph" }],
        });
        break;
      }
      case "thematicBreak":
        out.push({ type: "horizontalRule" });
        break;
      case "code":
        out.push({ type: "codeBlock", content: n.value ? [text(n.value)] : [] });
        break;
      case "table":
        out.push({
          type: "table",
          content: n.children.map((row, r) => ({
            type: "tableRow",
            content: row.children.map((cell) => ({
              type: r === 0 ? "tableHeader" : "tableCell",
              content: [{ type: "paragraph", content: inline(cell.children) }],
            })),
          })),
        });
        break;
      case "html":
        break; // raw HTML in Markdown was never rendered; it isn't carried over either
      default:
        if ("children" in n) out.push(...blocks(n.children as MdContent[]));
    }
  }
  return out;
}

/** Markdown (old guides, or pasted Markdown) → a Tiptap document. */
export function markdownToDoc(md: string): Doc {
  // Shortcodes must stand alone on a line: give them their own paragraph.
  const prepared = md.replace(/\r\n?/g, "\n").replace(/^(\{\{[^}\n]+\}\})$/gm, "\n$1\n");
  const tree = mdParser.parse(prepared) as MdRoot;
  const content = blocks(tree.children);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/** Plain text pasted from ChatGPT, Claude etc. that's really Markdown. */
export function looksLikeMarkdown(s: string) {
  const lines = s.split("\n");
  const signals = [
    /^#{1,6} \S/m.test(s),
    lines.filter((l) => /^\s*([-*+]|\d+\.) \S/.test(l)).length >= 2,
    /\*\*[^*\n]+\*\*/.test(s),
    /^\|.+\|\s*\n\|[\s:|-]+\|/m.test(s),
    /^> \S/m.test(s),
    /\[[^\]\n]+\]\((https?:\/\/|\/)[^)\s]+\)/.test(s),
  ];
  return signals.filter(Boolean).length >= 1 && (s.includes("\n") || signals[2] || signals[5]);
}

// ───────── Sanitizing JSON from the editor (server side, on every save) ─────────

const BLOCKS = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "codeBlock",
  "image",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "embed",
  "hardBreak",
  "text",
]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);

/** Links we keep: http(s), mailto, site-relative and in-page anchors. Anything else is dropped. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const h = href.trim();
  if (!h || h.length > 2000) return null;
  if (/^\/(?!\/)/.test(h) || h.startsWith("#")) return h;
  try {
    const url = new URL(h);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : fallback;
};

/**
 * Keeps only what we render: known nodes, marks and attributes. `imageAllowed` decides which
 * image URLs survive (our storage only). Runs on the server before anything is stored.
 */
export function sanitizeDoc(input: unknown, imageAllowed: (src: string) => boolean): Doc {
  const node = (n: unknown): Node | null => {
    if (!n || typeof n !== "object") return null;
    const { type, attrs = {}, content, marks, text: t } = n as Node;
    if (typeof type !== "string" || !BLOCKS.has(type)) return null;
    const a = attrs as Record<string, unknown>;
    const kids = Array.isArray(content)
      ? content.map(node).filter((c): c is Node => !!c)
      : undefined;
    switch (type) {
      case "text": {
        const value = str(t, 20000);
        if (!value) return null;
        const ms = (Array.isArray(marks) ? marks : [])
          .filter((m): m is Mark => !!m && MARKS.has(m.type))
          .map((m): Mark | null => {
            if (m.type !== "link") return { type: m.type };
            const href = safeHref(m.attrs?.href);
            return href ? { type: "link", attrs: { href } } : null;
          })
          .filter((m): m is Mark => !!m);
        return ms.length ? { type, text: value, marks: ms } : { type, text: value };
      }
      case "heading":
        return { type, attrs: { level: int(a.level, 2, 6, 2) }, content: kids };
      case "orderedList":
        return { type, attrs: { start: int(a.start, 1, 9999, 1) }, content: kids };
      case "image": {
        const src = str(a.src, 1000);
        if (!src || !imageAllowed(src)) return null;
        return { type, attrs: { src, alt: str(a.alt, 300), title: str(a.title, 300) || null } };
      }
      case "tableHeader":
      case "tableCell":
        return {
          type,
          attrs: { colspan: int(a.colspan, 1, 20, 1), rowspan: int(a.rowspan, 1, 50, 1) },
          content: kids,
        };
      case "embed": {
        const kind = (EMBED_KINDS as readonly string[]).includes(a.kind as string)
          ? (a.kind as EmbedKind)
          : null;
        const service = typeof a.service === "string" && SLUG.test(a.service) ? a.service : null;
        return kind && service ? { type, attrs: { kind, service } } : null;
      }
      default:
        return kids ? { type, content: kids } : { type };
    }
  };
  const content =
    (input as Doc | null)?.type === "doc" && Array.isArray((input as Doc).content)
      ? (input as Doc).content
      : [];
  const clean = content.map(node).filter((c): c is Node => !!c);
  return { type: "doc", content: clean.length ? clean : [{ type: "paragraph" }] };
}

// ───────── JSON → hast (what the public page renders) → HTML (what's stored) ─────────

const el = (
  tagName: string,
  children: ElementContent[] = [],
  properties: Element["properties"] = {},
): Element => ({
  type: "element",
  tagName,
  properties,
  children,
});

function inlineHast(nodes: Node[] = []): ElementContent[] {
  const out: ElementContent[] = [];
  for (const n of nodes) {
    if (n.type === "hardBreak") {
      out.push(el("br"));
      continue;
    }
    if (n.type !== "text" || !n.text) continue;
    let node: ElementContent = { type: "text", value: n.text };
    // Marks wrap innermost first; the link goes outermost so it spans the whole run.
    const marks = [...(n.marks ?? [])].sort(
      (a, b) => Number(a.type === "link") - Number(b.type === "link"),
    );
    for (const m of marks) {
      if (m.type === "bold") node = el("strong", [node]);
      else if (m.type === "italic") node = el("em", [node]);
      else if (m.type === "underline") node = el("u", [node]);
      else if (m.type === "strike") node = el("s", [node]);
      else if (m.type === "code") node = el("code", [node]);
      else if (m.type === "link") {
        const href = safeHref(m.attrs?.href);
        if (href) node = el("a", [node], { href });
      }
    }
    out.push(node);
  }
  return out;
}

function blockHast(n: Node, imageAllowed: (src: string) => boolean): ElementContent | null {
  const kids = (nodes: Node[] = []) =>
    nodes.map((c) => blockHast(c, imageAllowed)).filter((c): c is ElementContent => !!c);
  switch (n.type) {
    case "paragraph":
      return el("p", inlineHast(n.content));
    case "heading":
      return el(`h${int(n.attrs?.level, 2, 6, 2)}`, inlineHast(n.content));
    case "bulletList":
      return el("ul", kids(n.content));
    case "orderedList": {
      const start = int(n.attrs?.start, 1, 9999, 1);
      return el("ol", kids(n.content), start !== 1 ? { start } : {});
    }
    case "listItem":
      return el("li", kids(n.content));
    case "blockquote":
      return el("blockquote", kids(n.content));
    case "horizontalRule":
      return el("hr");
    case "codeBlock":
      return el("pre", [el("code", inlineHast(n.content))]);
    case "image": {
      const src = typeof n.attrs?.src === "string" ? n.attrs.src : "";
      if (!src || !imageAllowed(src)) return null;
      const title =
        typeof n.attrs?.title === "string" && n.attrs.title ? { title: n.attrs.title } : {};
      return el("img", [], {
        src,
        alt: typeof n.attrs?.alt === "string" ? n.attrs.alt : "",
        ...title,
      });
    }
    case "table": {
      const rows = (n.content ?? []).filter((r) => r.type === "tableRow");
      const header = rows[0]?.content?.every((c) => c.type === "tableHeader");
      const tr = (r: Node) =>
        el(
          "tr",
          (r.content ?? []).map((c) => {
            // A cell holding one paragraph renders its text directly.
            const inner =
              c.content?.length === 1 && c.content[0].type === "paragraph"
                ? inlineHast(c.content[0].content)
                : kids(c.content);
            const span = {
              ...(int(c.attrs?.colspan, 1, 20, 1) > 1
                ? { colSpan: int(c.attrs?.colspan, 1, 20, 1) }
                : {}),
              ...(int(c.attrs?.rowspan, 1, 50, 1) > 1
                ? { rowSpan: int(c.attrs?.rowspan, 1, 50, 1) }
                : {}),
            };
            return el(c.type === "tableHeader" ? "th" : "td", inner, span);
          }),
        );
      return el("table", [
        ...(header ? [el("thead", [tr(rows[0])])] : []),
        el("tbody", (header ? rows.slice(1) : rows).map(tr)),
      ]);
    }
    case "embed": {
      const kind = n.attrs?.kind;
      const service = n.attrs?.service;
      if (
        !(EMBED_KINDS as readonly unknown[]).includes(kind) ||
        typeof service !== "string" ||
        !SLUG.test(service)
      )
        return null;
      return el("div", [], { dataEmbed: kind as string, dataService: service });
    }
    default:
      return null;
  }
}

/** The allowlist renderer: a Tiptap document → a hast tree (no unknown tags or attributes). */
export function docToHast(doc: Doc, imageAllowed: (src: string) => boolean): Root {
  return {
    type: "root",
    children: (doc.content ?? [])
      .map((n) => blockHast(n, imageAllowed))
      .filter((c): c is ElementContent => !!c) as RootContent[],
  };
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => escape(s).replace(/"/g, "&quot;");
const VOID = new Set(["br", "hr", "img"]);
const ATTR: Record<string, string> = {
  colSpan: "colspan",
  rowSpan: "rowspan",
  dataEmbed: "data-embed",
  dataService: "data-service",
};

/** hast → HTML string (only what docToHast produced: escaped text, known attributes). */
export function hastToHtml(node: Root | ElementContent): string {
  if (node.type === "text") return escape(node.value);
  if (node.type === "root")
    return node.children.map((c) => hastToHtml(c as ElementContent)).join("");
  if (node.type !== "element") return "";
  const attrs = Object.entries(node.properties ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${ATTR[k] ?? k.toLowerCase()}="${escapeAttr(String(v))}"`)
    .join("");
  if (VOID.has(node.tagName)) return `<${node.tagName}${attrs}>`;
  return `<${node.tagName}${attrs}>${node.children.map(hastToHtml).join("")}</${node.tagName}>`;
}

/** The sanitized HTML stored with every save (and published with every update). */
export const docToHtml = (doc: Doc, imageAllowed: (src: string) => boolean) =>
  hastToHtml(docToHast(doc, imageAllowed));

// ───────── Counting ─────────

export function docText(doc: Doc): string {
  const walk = (n: Node): string =>
    n.type === "text"
      ? (n.text ?? "")
      : n.type === "embed"
        ? ""
        : (n.content ?? []).map(walk).join(" ");
  return doc.content.map(walk).join(" ").replace(/\s+/g, " ").trim();
}
export const wordCount = (doc: Doc) => (docText(doc) ? docText(doc).split(" ").length : 0);
/** Minutes to read at 225 words a minute, at least 1. */
export const docReadMinutes = (doc: Doc) => Math.max(1, Math.round(wordCount(doc) / 225));

/** Images without alt text (warned about before publishing). */
export function imagesWithoutAlt(doc: Doc): number {
  const walk = (n: Node): number =>
    (n.type === "image" && !String(n.attrs?.alt ?? "").trim() ? 1 : 0) +
    (n.content ?? []).reduce((s, c) => s + walk(c), 0);
  return doc.content.reduce((s, n) => s + walk(n), 0);
}

/** H2–H4 headings, in order (the editor's outline panel). */
export function docOutline(doc: Doc): { level: number; text: string; index: number }[] {
  return doc.content
    .flatMap((n, index) =>
      n.type === "heading"
        ? [
            {
              level: int(n.attrs?.level, 2, 6, 2),
              text: (n.content ?? [])
                .map((c) => c.text ?? "")
                .join("")
                .trim(),
              index,
            },
          ]
        : [],
    )
    .filter((h) => h.level <= 4 && h.text);
}

// ───────── Paste cleanup (Google Docs, Word, web pages) ─────────

const htmlParser = unified().use(rehypeParse, { fragment: true });
const KEEP = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "del",
  "code",
  "pre",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "br",
  "img",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
]);
const DROP = new Set([
  "script",
  "style",
  "meta",
  "link",
  "title",
  "head",
  "xml",
  "o:p",
  "iframe",
  "object",
  "embed",
  "svg",
  "noscript",
  "template",
  "button",
  "input",
  "form",
]);
const KEEP_ATTRS: Record<string, string[]> = {
  a: ["href"],
  img: ["src", "alt", "title"],
  th: ["colSpan", "rowSpan"],
  td: ["colSpan", "rowSpan"],
  ol: ["start"],
};

const styleOf = (e: Element) => String(e.properties?.style ?? "");
const isBoldStyle = (s: string) => /font-weight:\s*(bold|[6-9]00)/i.test(s);
const isItalicStyle = (s: string) => /font-style:\s*italic/i.test(s);

/** Any visible text (not just spaces or no-break spaces) or an image, at any depth. */
function hasContent(n: ElementContent): boolean {
  if (n.type === "text") return /[^\s\u00a0]/.test(n.value);
  if (n.type !== "element") return false;
  return n.tagName === "img" || n.children.some(hasContent);
}

/**
 * Cleans HTML from the clipboard before the editor parses it: keeps structure (headings, bold,
 * italic, links, lists, tables, images) and drops fonts, colours, sizes, spans, classes, empty
 * paragraphs, Google Docs' <b id="docs-internal-guid…"> wrapper and Word's mso-* markup.
 * Google Docs marks bold/italic with inline styles on spans; those become <strong>/<em>.
 */
export function cleanPastedHtml(html: string): string {
  // Word conditional comments and namespaced tags.
  const pre = html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<\/?(o|w|v|m):[^>]*>/gi, "");
  const tree = htmlParser.parse(pre) as Root;
  const clean = (nodes: RootContent[]): ElementContent[] => {
    const out: ElementContent[] = [];
    for (const n of nodes) {
      if (n.type === "text") {
        if (n.value) out.push(n);
        continue;
      }
      if (n.type !== "element") continue;
      const tag = n.tagName.toLowerCase();
      if (DROP.has(tag)) continue;
      const style = styleOf(n);
      // Word's list numbers ("1.", bullets) are typed-out text in a span: the list is the structure.
      if (/mso-list:\s*ignore/i.test(style)) continue;
      let children = clean(n.children as RootContent[]);
      // Google Docs wraps the whole paste in <b style="font-weight:normal" id="docs-internal-guid-…">.
      if (
        tag === "b" &&
        (/^docs-internal-guid/.test(String(n.properties?.id ?? "")) ||
          /font-weight:\s*(normal|400)/i.test(style))
      ) {
        out.push(...children);
        continue;
      }
      // Bold/italic expressed as styles (Google Docs spans, Word).
      if (tag === "span" || !KEEP.has(tag)) {
        if (isItalicStyle(style)) children = [el("em", children)];
        if (isBoldStyle(style)) children = [el("strong", children)];
        // Block-level wrappers (div, section…) keep their content as-is.
        out.push(...children);
        continue;
      }
      const keep = KEEP_ATTRS[tag] ?? [];
      const properties: Element["properties"] = {};
      for (const k of keep) if (n.properties?.[k] !== undefined) properties[k] = n.properties[k];
      if (tag === "a") {
        const href = safeHref(properties.href);
        if (!href) {
          out.push(...children);
          continue;
        }
        properties.href = href;
      }
      let node: Element = el(tag === "h1" ? "h2" : tag, children, properties);
      if (["p", "li", "td", "th"].includes(tag)) {
        if (isItalicStyle(style)) node = { ...node, children: [el("em", node.children)] };
        if (isBoldStyle(style) && tag === "p")
          node = { ...node, children: [el("strong", node.children)] };
      }
      // Empty paragraphs (Word's &nbsp; spacers, Google Docs' <br> lines) go.
      if (tag === "p" && !hasContent(node)) continue;
      out.push(node);
    }
    return out;
  };
  return hastToHtml({ type: "root", children: clean(tree.children) as RootContent[] });
}

// ───────── Rendering support: blocks, heading ids, table of contents ─────────

/** What the public page renders: hast chunks, with embeds (the live budget box) between them. */
export type GuideBlock = { kind: "html"; tree: Root } | { kind: "budget-range"; service: string };
export type OutlineItem = { id: string; text: string; depth: 2 | 3 };
export type TocGroup = { id: string; text: string; children: OutlineItem[] };

export function textOf(node: Root | ElementContent): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map((c) => textOf(c as ElementContent)).join("") : "";
}

const headingSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 60)
    .replace(/-+$/, "") || "section";

/**
 * A document → render blocks (split at embeds) plus the outline. Every h2–h4 gets a stable id
 * from its text, unique across the guide; the outline (table of contents) is h2s and h3s.
 */
export function guideBlocks(doc: Doc, imageAllowed: (src: string) => boolean) {
  const blocks: GuideBlock[] = [];
  let run: Node[] = [];
  const flush = () => {
    if (run.length)
      blocks.push({ kind: "html", tree: docToHast({ type: "doc", content: run }, imageAllowed) });
    run = [];
  };
  for (const n of doc.content ?? []) {
    if (
      n.type === "embed" &&
      n.attrs?.kind === "budget-range" &&
      typeof n.attrs.service === "string" &&
      SLUG.test(n.attrs.service)
    ) {
      flush();
      blocks.push({ kind: "budget-range", service: n.attrs.service });
    } else run.push(n);
  }
  flush();

  const seen = new Map<string, number>();
  const outline: OutlineItem[] = [];
  const walk = (node: Root | Element) => {
    for (const child of node.children) {
      if (child.type !== "element") continue;
      if (/^h[2-4]$/.test(child.tagName)) {
        const t = textOf(child).trim();
        const base = headingSlug(t);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count ? `${base}-${count + 1}` : base;
        child.properties = { ...child.properties, id };
        if (child.tagName !== "h4")
          outline.push({ id, text: t, depth: child.tagName === "h3" ? 3 : 2 });
      } else walk(child);
    }
  };
  for (const b of blocks) if (b.kind === "html") walk(b.tree);
  return { blocks, outline };
}

/** h2s with their h3s. h3s before the first h2 are dropped (nothing to nest them under). */
export function groupOutline(items: OutlineItem[]): TocGroup[] {
  const groups: TocGroup[] = [];
  for (const item of items) {
    if (item.depth === 2) groups.push({ id: item.id, text: item.text, children: [] });
    else groups.at(-1)?.children.push(item);
  }
  return groups;
}

/** Width and height encoded in uploaded image names (`…-1200x800.webp`), for next/image. */
export function imageSize(src: string) {
  const m = src.match(/-(\d{2,5})x(\d{2,5})\.(?:png|jpe?g|webp|gif)$/i);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

/** The stored document, or the old Markdown converted on the fly (guides not migrated yet). */
export const guideDoc = (bodyJson: unknown, bodyMd: string | null | undefined): Doc =>
  bodyJson && (bodyJson as Doc).type === "doc" ? (bodyJson as Doc) : markdownToDoc(bodyMd ?? "");

/**
 * Agency profiles a guide links to, in order of first mention: links to /agency/<slug>, relative
 * or on our own domain (`host`, e.g. "ytagencies.com"). For "Agencies mentioned".
 */
export function agencySlugsIn(doc: Doc, host: string): string[] {
  const slugs: string[] = [];
  const own = new RegExp(
    `^(?:https?://(?:www\.)?${host.replace(/\./g, "\.")})?/agency/([a-z0-9-]+)/?(?:[?#].*)?$`,
  );
  const visit = (nodes: Node[] = []) => {
    for (const n of nodes) {
      for (const m of n.marks ?? []) {
        const href = m.type === "link" ? m.attrs?.href : undefined;
        const slug = typeof href === "string" ? href.match(own)?.[1] : undefined;
        if (slug && !slugs.includes(slug)) slugs.push(slug);
      }
      visit(n.content);
    }
  };
  visit(doc.content);
  return slugs;
}
