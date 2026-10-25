// Guide blocks: structured nodes in a guide document (comparison table, product card, A vs B,
// pros & cons, FAQ, CTA box, directory stats, stat row, button, list label, quote). One definition per block drives the editor's form,
// the server's sanitizer (only these exact attributes survive) and the plain text used for search
// and word counts. The public page and the editor render them with the same React components
// (components/guide-blocks.tsx). No imports: tested (tests/guide-blocks.test.mjs).

export type Field =
  | { key: string; label: string; kind: "text"; max: number; placeholder?: string; hint?: string }
  | { key: string; label: string; kind: "textarea"; max: number; hint?: string }
  | { key: string; label: string; kind: "boolean"; hint?: string }
  /** A path on this site only (/agencies, /request-proposals…). */
  | { key: string; label: string; kind: "internalUrl"; placeholder?: string }
  /** An outside https link (a competitor's pricing page). Rendered rel="nofollow noopener noreferrer". */
  | { key: string; label: string; kind: "externalUrl"; placeholder?: string }
  /** An image uploaded to guide media (the same rule as images in the text). */
  | { key: string; label: string; kind: "image" }
  /** A section on this guide (#id), picked from its headings and product cards. */
  | { key: string; label: string; kind: "anchor" }
  /** A directory service, by slug. */
  | { key: string; label: string; kind: "service" }
  | { key: string; label: string; kind: "select"; options: { value: string; label: string }[] }
  /** A list of short lines. */
  | { key: string; label: string; kind: "list"; max: number; itemMax: number; hint?: string }
  /** Repeating rows of sub-fields. */
  | { key: string; label: string; kind: "rows"; max: number; fields: Field[]; addLabel: string };

export const BLOCK_TYPES = [
  "comparisonTable",
  "productCard",
  "abTable",
  "prosCons",
  "faq",
  "ctaBox",
  "directoryStats",
  "statRow",
  "button",
  "listLabel",
  "quote",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export type BlockAttrs = Record<string, unknown>;

type Def = { label: string; description: string; fields: Field[]; empty: () => BlockAttrs };

export const BLOCKS: Record<BlockType, Def> = {
  comparisonTable: {
    label: "Comparison table",
    description: "Name, best for, starting price, key difference and a link to its section.",
    fields: [
      {
        key: "rows",
        label: "Rows",
        kind: "rows",
        max: 12,
        addLabel: "Add a row",
        fields: [
          { key: "name", label: "Name", kind: "text", max: 80 },
          { key: "bestFor", label: "Best for", kind: "text", max: 120 },
          { key: "price", label: "Starting price", kind: "text", max: 60, placeholder: "[price]" },
          { key: "difference", label: "Key difference", kind: "text", max: 160 },
          { key: "anchor", label: "Read (section)", kind: "anchor" },
        ],
      },
      { key: "highlightFirst", label: "Highlight the first row", kind: "boolean" },
    ],
    empty: () => ({
      rows: [{ name: "", bestFor: "", price: "", difference: "", anchor: "" }],
      highlightFirst: true,
    }),
  },
  productCard: {
    label: "Product card",
    description: "A numbered option with its points, price, a call to action and who it's for.",
    fields: [
      { key: "badge", label: "Badge", kind: "text", max: 60, placeholder: "BEST FOR YOUTUBE SPECIALISTS" },
      { key: "title", label: "Title", kind: "text", max: 100 },
      { key: "description", label: "Description", kind: "textarea", max: 800 },
      {
        key: "points",
        label: "Points",
        kind: "rows",
        max: 10,
        addLabel: "Add a point",
        fields: [
          {
            key: "kind",
            label: "Type",
            kind: "select",
            options: [
              { value: "good", label: "✓ Good" },
              { value: "caveat", label: "– Caveat" },
            ],
          },
          { key: "text", label: "Point", kind: "text", max: 200 },
        ],
      },
      { key: "image", label: "Screenshot (optional)", kind: "image" },
      { key: "imageAlt", label: "Screenshot alt text", kind: "text", max: 200 },
      { key: "caption", label: "Caption", kind: "text", max: 200 },
      { key: "price", label: "Price", kind: "text", max: 120, placeholder: "[price]" },
      { key: "priceSource", label: "Price source (link)", kind: "externalUrl", placeholder: "https://…/pricing" },
      { key: "ctaLabel", label: "Button label", kind: "text", max: 40 },
      { key: "ctaHref", label: "Button link (on this site)", kind: "internalUrl", placeholder: "/agencies" },
      { key: "chooseIf", label: "Choose this if…", kind: "text", max: 200 },
      { key: "ours", label: "This is our product", kind: "boolean", hint: "Marks the YT Agencies card." },
    ],
    empty: () => ({
      badge: "",
      title: "",
      description: "",
      points: [{ kind: "good", text: "" }],
      image: "",
      imageAlt: "",
      caption: "",
      price: "",
      priceSource: "",
      ctaLabel: "",
      ctaHref: "",
      chooseIf: "",
      ours: false,
    }),
  },
  abTable: {
    label: "A vs B table",
    description: "Two options side by side, row by row.",
    fields: [
      { key: "aLabel", label: "Column A", kind: "text", max: 60 },
      { key: "bLabel", label: "Column B", kind: "text", max: 60 },
      {
        key: "rows",
        label: "Rows",
        kind: "rows",
        max: 15,
        addLabel: "Add a row",
        fields: [
          { key: "label", label: "Row", kind: "text", max: 80 },
          { key: "a", label: "A", kind: "text", max: 160 },
          { key: "b", label: "B", kind: "text", max: 160 },
        ],
      },
      { key: "bBetter", label: "When B is better (optional)", kind: "textarea", max: 400 },
    ],
    empty: () => ({ aLabel: "", bLabel: "", rows: [{ label: "", a: "", b: "" }], bBetter: "" }),
  },
  prosCons: {
    label: "Pros & cons",
    description: "\"Good\" and \"Watch out\" side by side.",
    fields: [
      { key: "good", label: "Good", kind: "list", max: 8, itemMax: 200 },
      { key: "watch", label: "Watch out", kind: "list", max: 8, itemMax: 200 },
    ],
    empty: () => ({ good: [""], watch: [""] }),
  },
  faq: {
    label: "FAQ",
    description: "Questions and answers, shown as an accordion (adds FAQ schema).",
    fields: [
      {
        key: "items",
        label: "Questions",
        kind: "rows",
        max: 12,
        addLabel: "Add a question",
        fields: [
          { key: "q", label: "Question", kind: "text", max: 200 },
          { key: "a", label: "Answer", kind: "textarea", max: 1200 },
        ],
      },
    ],
    empty: () => ({ items: [{ q: "", a: "" }] }),
  },
  ctaBox: {
    label: "CTA box",
    description: "A dark box (or a navy banner) with a heading, short lines and up to two buttons.",
    fields: [
      {
        key: "variant",
        label: "Style",
        kind: "select",
        options: [
          { value: "box", label: "Box" },
          { value: "banner", label: "Banner (navy)" },
        ],
      },
      { key: "heading", label: "Heading", kind: "text", max: 100 },
      { key: "lines", label: "Lines (up to 3)", kind: "list", max: 3, itemMax: 160 },
      { key: "primaryLabel", label: "Primary button", kind: "text", max: 40 },
      { key: "primaryHref", label: "Primary link (on this site)", kind: "internalUrl", placeholder: "/agencies" },
      { key: "secondaryLabel", label: "Secondary button (optional)", kind: "text", max: 40 },
      { key: "secondaryHref", label: "Secondary link (on this site)", kind: "internalUrl", placeholder: "/request-proposals" },
    ],
    empty: () => ({
      variant: "box",
      heading: "",
      lines: [""],
      primaryLabel: "",
      primaryHref: "",
      secondaryLabel: "",
      secondaryHref: "",
    }),
  },
  directoryStats: {
    label: "Directory stats",
    description: "Live counts from the directory: agencies, Verified, and how many offer a service.",
    fields: [{ key: "service", label: "Service", kind: "service" }],
    empty: () => ({ service: "" }),
  },
  statRow: {
    label: "Stat row",
    description: "Up to three numbers with a label each. Link the source.",
    fields: [
      {
        key: "items",
        label: "Stats",
        kind: "rows",
        max: 3,
        addLabel: "Add a stat",
        fields: [
          { key: "value", label: "Value", kind: "text", max: 24, placeholder: "73%" },
          { key: "label", label: "Label", kind: "text", max: 120 },
          { key: "source", label: "Source (link)", kind: "externalUrl", placeholder: "https://…" },
        ],
      },
    ],
    empty: () => ({ items: [{ value: "", label: "", source: "" }] }),
  },
  button: {
    label: "Button",
    description: "One primary button to a page on this site.",
    fields: [
      { key: "label", label: "Label", kind: "text", max: 40 },
      { key: "href", label: "Link (on this site)", kind: "internalUrl", placeholder: "/request-proposals" },
    ],
    empty: () => ({ label: "", href: "" }),
  },
  listLabel: {
    label: "List label",
    description: "A short coloured label above a list (\"In this order:\").",
    fields: [{ key: "text", label: "Label", kind: "text", max: 60 }],
    empty: () => ({ text: "" }),
  },
  quote: {
    label: "Quote",
    description: "A quote with who said it. Shown only with a name: no anonymous testimonials.",
    fields: [
      { key: "text", label: "Quote", kind: "textarea", max: 600 },
      { key: "name", label: "Name (required)", kind: "text", max: 80 },
      { key: "role", label: "Role", kind: "text", max: 100, placeholder: "Head of growth, Acme" },
      { key: "cite", label: "Source (link)", kind: "externalUrl", placeholder: "https://…" },
    ],
    empty: () => ({ text: "", name: "", role: "", cite: "" }),
  },
};

export const isBlockType = (t: unknown): t is BlockType =>
  (BLOCK_TYPES as readonly unknown[]).includes(t);

const INTERNAL = /^\/(?!\/)[A-Za-z0-9\-._~/?#=&%+]*$/;
const ANCHOR = /^[a-z0-9-]{1,80}$/;
const SLUG = /^[a-z0-9-]{1,80}$/;

/** A path on this site: "/agencies", "/guides/x#y". Never "//host", a scheme or a space. */
export const internalUrl = (v: unknown) =>
  typeof v === "string" && v.length <= 300 && INTERNAL.test(v.trim()) ? v.trim() : "";

/** An outside http(s) link, normalized; anything else (javascript:, mailto:, relative) is dropped. */
export function externalUrl(v: unknown) {
  if (typeof v !== "string" || !v.trim() || v.length > 500) return "";
  try {
    const u = new URL(v.trim());
    return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password
      ? u.href
      : "";
  } catch {
    return "";
  }
}

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max) : "";

function cleanField(f: Field, v: unknown, imageAllowed: (src: string) => boolean): unknown {
  switch (f.kind) {
    case "text":
      return str(v, f.max).replace(/\s*\n\s*/g, " ");
    case "textarea":
      return str(v, f.max);
    case "boolean":
      return v === true;
    case "internalUrl":
      return internalUrl(v);
    case "externalUrl":
      return externalUrl(v);
    case "image": {
      const src = str(v, 1000);
      return src && imageAllowed(src) ? src : "";
    }
    case "anchor": {
      const a = str(v, 80).replace(/^#/, "");
      return ANCHOR.test(a) ? a : "";
    }
    case "service": {
      const s = str(v, 80);
      return SLUG.test(s) ? s : "";
    }
    case "select": {
      const s = str(v, 40);
      return f.options.some((o) => o.value === s) ? s : f.options[0].value;
    }
    case "list":
      return (Array.isArray(v) ? v : []).slice(0, f.max).map((x) => str(x, f.itemMax));
    case "rows":
      return (Array.isArray(v) ? v : [])
        .slice(0, f.max)
        .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r))
        .map((r) => cleanFields(f.fields, r, imageAllowed));
  }
}

function cleanFields(fields: Field[], attrs: Record<string, unknown>, imageAllowed: (src: string) => boolean) {
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f.key] = cleanField(f, attrs[f.key], imageAllowed);
  return out;
}

/**
 * A block's attributes with only its own fields, each cleaned to its kind: unknown keys are
 * dropped, strings are capped, links checked (internal paths only for buttons, http(s) for
 * sources), images only from guide media. Text is stored as text: it's escaped when rendered.
 */
export function sanitizeBlock(
  type: BlockType,
  attrs: unknown,
  imageAllowed: (src: string) => boolean,
): BlockAttrs {
  const a = attrs && typeof attrs === "object" && !Array.isArray(attrs) ? (attrs as Record<string, unknown>) : {};
  return cleanFields(BLOCKS[type].fields, a, imageAllowed);
}

const lines = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);
const rows = (v: unknown) =>
  Array.isArray(v) ? v.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : [];
const s = (v: unknown) => (typeof v === "string" ? v : "");

/** A block's readable text (search, word count, the stored HTML's text). */
export function blockText(type: BlockType, a: BlockAttrs): string {
  const parts: string[] = [];
  switch (type) {
    case "comparisonTable":
      for (const r of rows(a.rows)) parts.push(s(r.name), s(r.bestFor), s(r.price), s(r.difference));
      break;
    case "productCard":
      parts.push(s(a.badge), s(a.title), s(a.description));
      for (const p of rows(a.points)) parts.push(s(p.text));
      parts.push(s(a.caption), s(a.price), s(a.chooseIf));
      break;
    case "abTable":
      parts.push(s(a.aLabel), s(a.bLabel));
      for (const r of rows(a.rows)) parts.push(s(r.label), s(r.a), s(r.b));
      parts.push(s(a.bBetter));
      break;
    case "prosCons":
      parts.push(...lines(a.good), ...lines(a.watch));
      break;
    case "faq":
      for (const i of rows(a.items)) parts.push(s(i.q), s(i.a));
      break;
    case "ctaBox":
      parts.push(s(a.heading), ...lines(a.lines));
      break;
    case "directoryStats":
      break; // live numbers, not text
    case "statRow":
      for (const i of rows(a.items)) parts.push(s(i.value), s(i.label));
      break;
    case "button":
      parts.push(s(a.label));
      break;
    case "listLabel":
      parts.push(s(a.text));
      break;
    case "quote":
      parts.push(s(a.text), s(a.name), s(a.role));
      break;
  }
  return parts.filter((p) => p.trim()).join(" ");
}

/** FAQ items from every FAQ block, in order (one FAQPage per page). */
export function faqItems(nodes: { type: string; attrs?: BlockAttrs }[]) {
  return nodes
    .filter((n) => n.type === "faq")
    .flatMap((n) => rows(n.attrs?.items))
    .map((i) => ({ question: s(i.q).trim(), answer: s(i.a).trim() }))
    .filter((i) => i.question && i.answer);
}

/** Product names in the comparison table(s), in order (the page's ItemList). */
export function comparisonItems(nodes: { type: string; attrs?: BlockAttrs }[]) {
  return nodes
    .filter((n) => n.type === "comparisonTable")
    .flatMap((n) => rows(n.attrs?.rows))
    .map((r) => ({ name: s(r.name).trim(), anchor: s(r.anchor) }))
    .filter((r) => r.name);
}

/** "[price]", "[fee]": placeholders still to fill in (the editor warns before publishing). */
export const placeholdersIn = (text: string) => text.match(/\[[a-z][a-z ]{1,30}\]/gi) ?? [];
