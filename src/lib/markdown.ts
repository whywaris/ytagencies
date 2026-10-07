import type { Root } from "hast";
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
// javascript: links. The only thing besides Markdown is an allowlisted shortcode line.

/** `{{budget-range <service-slug>}}` alone on a line renders the live budget box. */
const SHORTCODE = /^\{\{budget-range ([a-z0-9-]{1,80})\}\}$/;

export type GuideBlock =
  { kind: "markdown"; tree: Root } | { kind: "budget-range"; service: string };

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, {
    ...defaultSchema,
    protocols: { ...defaultSchema.protocols, src: ["https"] },
  });

export function markdownToTree(md: string): Root {
  return processor.runSync(processor.parse(md)) as Root;
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

/** Plain text of a guide, for word counts and fallbacks (shortcodes removed). */
export function plainText(md: string) {
  return md
    .replace(/^\{\{[^}]*\}\}$/gm, "")
    .replace(/[#>*_`~[\]()!|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
