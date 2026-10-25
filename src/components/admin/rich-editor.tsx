"use client";

import { Image } from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import {
  EditorContent,
  Extension,
  Node as TiptapNode,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
  type Editor,
  type Range,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Suggestion } from "@tiptap/suggestion";
import {
  BarChart3,
  Bold,
  CircleHelp,
  Columns2,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  LayoutList,
  Link2,
  List,
  ListOrdered,
  Megaphone,
  Pilcrow,
  Plus,
  Quote,
  Redo2,
  Rows3,
  Settings2,
  SquareCheckBig,
  Table2,
  Trash2,
  Undo2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { DropdownMenu, Popover } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { guideBlockNodes, openNextBlock } from "@/components/admin/guide-block-node";
import { usePortalContainer } from "@/components/admin/portal";
import type { DirectoryStatsData } from "@/components/guide-blocks";
import { directoryStatsFor, importRemoteImage, uploadGuideImage } from "@/lib/actions/admin-guides";
import { BLOCKS, type BlockType } from "@/lib/guide-blocks";
import {
  cleanPastedHtml,
  docReadMinutes,
  looksLikeMarkdown,
  markdownToDoc,
  safeHref,
  wordCount,
  type Doc,
} from "@/lib/guide-content";
import { guideImageAllowed } from "@/lib/guide-media";
import type { FormResult } from "@/lib/validation/lead";
import { cn } from "@/lib/utils";

// WYSIWYG guide editor (Tiptap, MIT extensions only). The document is Tiptap JSON; the server
// sanitizes it and renders the HTML on save (lib/guide-content.ts). Public pages never load this.
// The canvas uses the public page's stylesheet (.guide-content) and guide blocks use the public
// page's components, so what you see here is what the page shows.

export type ServiceOption = { slug: string; name: string };

/**
 * A server action call that never throws: a failed request (network, or a page opened before a
 * new deployment, whose actions no longer exist) becomes an error result instead of crashing the
 * editor and losing unsaved changes.
 */
export const reach = <T,>(call: Promise<FormResult<T>>): Promise<FormResult<T>> =>
  call.catch(() => ({
    ok: false,
    error:
      "Couldn't reach the server. The site may have just been updated: copy your recent changes, then reload the page.",
  }));

const MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const btn =
  "flex size-8 shrink-0 items-center justify-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text disabled:opacity-40 aria-pressed:bg-surface-2 aria-pressed:text-text";
const icon = "size-4 [stroke-width:1.5]";
const menu =
  "z-50 min-w-48 rounded-lg border border-line bg-bg p-1 text-text shadow-lg outline-none";
const menuItem =
  "flex h-8 w-full cursor-default items-center gap-2 rounded-md px-2 text-left outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2 hover:bg-surface-2";
const field = "h-9 w-full rounded-lg border border-line bg-bg px-3";

// ───────── Embed: shortcodes such as {{budget-range <service>}} ─────────

function EmbedView({
  node,
  updateAttributes,
  deleteNode,
  extension,
  selected,
}: ReactNodeViewProps) {
  const container = usePortalContainer();
  const services = (extension.options as { services: ServiceOption[] }).services;
  const service = node.attrs.service as string;
  const name = services.find((s) => s.slug === service)?.name ?? service;
  return (
    <NodeViewWrapper
      data-drag-handle
      contentEditable={false}
      className={cn(
        "my-6 flex items-center gap-3 rounded-xl border border-line bg-surface p-4",
        selected && "outline-2 outline-accent",
      )}
    >
      <Wallet className={cn(icon, "text-text-2")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Budget range</span>
        <span className="block text-admin-meta">
          Live budget box for {name}. Real figures appear on the published page.
        </span>
      </span>
      <Popover.Root>
        <Popover.Trigger className={btn} aria-label="Budget range settings">
          <Settings2 className={icon} aria-hidden />
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Content
            align="end"
            sideOffset={6}
            className={cn(menu, "flex w-72 flex-col gap-3 p-3")}
          >
            <label className="flex flex-col gap-1.5">
              <span className="font-medium">Service</span>
              <select
                value={service}
                onChange={(e) => updateAttributes({ service: e.target.value })}
                className={field}
              >
                {!services.some((s) => s.slug === service) && (
                  <option value={service}>{service}</option>
                )}
                {services.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={deleteNode}
              className="flex h-8 items-center gap-2 self-start rounded-md px-2 text-destructive hover:bg-surface-2"
            >
              <Trash2 className={icon} aria-hidden />
              Remove block
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </NodeViewWrapper>
  );
}

const Embed = TiptapNode.create<{ services: ServiceOption[] }>({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addOptions: () => ({ services: [] }),
  addAttributes: () => ({
    kind: { default: "budget-range", parseHTML: (el) => el.getAttribute("data-embed") },
    service: { default: null, parseHTML: (el) => el.getAttribute("data-service") },
  }),
  parseHTML: () => [{ tag: "div[data-embed]" }],
  renderHTML: ({ node }) => [
    "div",
    { "data-embed": node.attrs.kind, "data-service": node.attrs.service },
  ],
  addNodeView: () => ReactNodeViewRenderer(EmbedView),
});

// ───────── Image with a required alt text field ─────────

function ImageView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string | null) ?? "";
  const uploading = !guideImageAllowed(src);
  return (
    <NodeViewWrapper
      as="figure"
      className={cn("guide-figure", selected && "outline-2 outline-offset-4 outline-accent")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- editor canvas, not a page */}
      <img src={src} alt={alt} data-drag-handle className={cn(uploading && "opacity-50")} />
      <input
        value={alt}
        onChange={(e) => updateAttributes({ alt: e.target.value.slice(0, 300) })}
        placeholder={uploading ? "Copying image…" : "Alt text: describe the image (required)"}
        aria-label="Alt text"
        aria-invalid={!alt}
        className={cn(
          "h-8 rounded-md border bg-bg px-2 text-admin-meta",
          alt ? "border-line" : "border-warning",
        )}
      />
    </NodeViewWrapper>
  );
}

const GuideImage = Image.extend({
  addNodeView: () => ReactNodeViewRenderer(ImageView),
});

// ───────── Inserter: the "+" button and the "/" menu share one list ─────────

type InsertItem = {
  label: string;
  group: "Basic" | "Guide blocks";
  icon: LucideIcon;
  keywords?: string;
  run: (editor: Editor, range: Range | null) => void;
};
type SlashState = {
  items: InsertItem[];
  index: number;
  rect: DOMRect | null;
  pick: (i: InsertItem) => void;
};

/**
 * Puts content where the inserter was opened: replacing the "/query" text (slash menu), the empty
 * paragraph the cursor is in, or after the block the cursor is in.
 */
function place(e: Editor, range: Range | null, content: object | object[]) {
  if (range) return e.chain().focus().deleteRange(range).insertContent(content).run();
  const { $from } = e.state.selection;
  if ($from.depth >= 1) {
    const top = $from.node(1);
    const start = $from.before(1);
    if (top.type.name === "paragraph" && top.content.size === 0)
      return e.chain().focus().insertContentAt({ from: start, to: start + top.nodeSize }, content).run();
    return e.chain().focus().insertContentAt($from.after(1), content).run();
  }
  return e.chain().focus().insertContentAt(e.state.selection.from, content).run();
}

const para = (text = "") => ({ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) });
const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  comparisonTable: Rows3,
  productCard: LayoutList,
  abTable: Columns2,
  prosCons: SquareCheckBig,
  faq: CircleHelp,
  ctaBox: Megaphone,
  directoryStats: BarChart3,
};

function insertItems(pickImage: () => void, firstService: () => string | undefined): InsertItem[] {
  const heading = (level: 2 | 3, icon: LucideIcon): InsertItem => ({
    label: `Heading ${level}`,
    group: "Basic",
    icon,
    keywords: "title h" + level,
    run: (e, r) => place(e, r, { type: "heading", attrs: { level } }),
  });
  return [
    { label: "Paragraph", group: "Basic", icon: Pilcrow, keywords: "text", run: (e, r) => place(e, r, para()) },
    heading(2, Heading2),
    heading(3, Heading3),
    {
      label: "Bulleted list",
      group: "Basic",
      icon: List,
      keywords: "list ul",
      run: (e, r) => place(e, r, { type: "bulletList", content: [{ type: "listItem", content: [para()] }] }),
    },
    {
      label: "Numbered list",
      group: "Basic",
      icon: ListOrdered,
      keywords: "list ol steps",
      run: (e, r) => place(e, r, { type: "orderedList", content: [{ type: "listItem", content: [para()] }] }),
    },
    { label: "Quote", group: "Basic", icon: Quote, run: (e, r) => place(e, r, { type: "blockquote", content: [para()] }) },
    {
      label: "Table",
      group: "Basic",
      icon: Table2,
      run: (e, r) => {
        const cell = (header: boolean) => ({ type: header ? "tableHeader" : "tableCell", content: [para()] });
        const row = (header: boolean) => ({ type: "tableRow", content: [cell(header), cell(header), cell(header)] });
        place(e, r, { type: "table", content: [row(true), row(false), row(false)] });
      },
    },
    {
      label: "Image",
      group: "Basic",
      icon: ImagePlus,
      keywords: "picture photo screenshot",
      run: (e, r) => {
        if (r) e.chain().focus().deleteRange(r).run();
        pickImage();
      },
    },
    ...(Object.keys(BLOCKS) as BlockType[]).map(
      (type): InsertItem => ({
        label: BLOCKS[type].label,
        group: "Guide blocks",
        icon: BLOCK_ICONS[type],
        keywords: BLOCKS[type].description,
        run: (e, r) => {
          openNextBlock();
          place(e, r, { type, attrs: BLOCKS[type].empty() });
        },
      }),
    ),
    {
      label: "Budget range",
      group: "Guide blocks",
      icon: Wallet,
      keywords: "price budget live",
      run: (e, r) => {
        const service = firstService();
        if (!service) return void toast.error("Add a service first.");
        place(e, r, { type: "embed", attrs: { kind: "budget-range", service } });
      },
    },
  ];
}

const matches = (item: InsertItem, q: string) =>
  `${item.label} ${item.keywords ?? ""} ${item.group}`.toLowerCase().includes(q.trim().toLowerCase());

// ───────── Editor ─────────

export function RichEditor({
  initial,
  services,
  ensureGuideId,
  onChange,
  onSave,
  header,
}: {
  initial: Doc;
  services: ServiceOption[];
  /** Saves the guide if it's new; uploads need its id. */
  ensureGuideId: () => Promise<string | null>;
  onChange: (doc: Doc) => void;
  /** Ctrl+S / Cmd+S. */
  onSave: () => void;
  /** Title and URL, above the toolbar's sticky area. */
  header?: React.ReactNode;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const slashRef = useRef<SlashState | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const plainPaste = useRef(false);
  const copying = useRef(new Set<string>());
  const [doc, setDoc] = useState(initial);
  // Callbacks the extensions call; refs so the editor is built once.
  const live = useRef({ ensureGuideId, onChange, services, onSave });
  useEffect(() => {
    live.current = { ensureGuideId, onChange, services, onSave };
  });

  const showSlash = (s: SlashState | null) => {
    slashRef.current = s;
    setSlash(s);
  };

  const editorRef = useRef<Editor | null>(null);
  /* eslint-disable react-hooks/refs -- the editor's callbacks read refs when they run (keys, paste,
     drop), never during render; refs keep them current without rebuilding the editor. */
  const editor = useEditor({
    immediatelyRender: false,
    content: initial,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4, 5, 6] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          // rel/target are decided on the public page: our own links stay internal.
          HTMLAttributes: { rel: null, target: null },
          isAllowedUri: (url) => !!safeHref(url),
        },
      }),
      TableKit.configure({ table: { resizable: false } }),
      GuideImage.configure({ allowBase64: true }),
      Embed.configure({ services }),
      ...guideBlockNodes({
        services: () => live.current.services,
        upload: async (file) => {
          const guideId = await live.current.ensureGuideId();
          if (!guideId) {
            toast.error("Give the guide a title first, so it can be saved.");
            return null;
          }
          return upload(guideId, file);
        },
        stats: loadStats,
      }),
      Placeholder.configure({ placeholder: "Write, or type / for blocks" }),
      Extension.create({
        name: "guideShortcuts",
        addKeyboardShortcuts: () => ({
          "Mod-k": () => {
            setLinkOpen(true);
            return true;
          },
          "Mod-s": () => {
            live.current.onSave();
            return true;
          },
        }),
      }),
      Extension.create({
        name: "slashMenu",
        addProseMirrorPlugins() {
          const items = insertItems(
            () => fileInput.current?.click(),
            () => live.current.services[0]?.slug,
          );
          return [
            Suggestion<InsertItem, InsertItem>({
              editor: this.editor,
              char: "/",
              startOfLine: true,
              allow: ({ state, range }) => {
                const $from = state.doc.resolve(range.from);
                return $from.parent.type.name === "paragraph" && $from.depth === 1;
              },
              items: ({ query }) => items.filter((i) => matches(i, query)),
              command: ({ editor: e, range, props }) => props.run(e, range),
              render: () => {
                const update = (p: {
                  items: InsertItem[];
                  command: (i: InsertItem) => void;
                  clientRect?: (() => DOMRect | null) | null;
                }) =>
                  showSlash(
                    p.items.length
                      ? {
                          items: p.items,
                          index: Math.min(slashRef.current?.index ?? 0, p.items.length - 1),
                          rect: p.clientRect?.() ?? null,
                          pick: p.command,
                        }
                      : null,
                  );
                return {
                  onStart: (p) => {
                    slashRef.current = null;
                    update(p);
                  },
                  onUpdate: update,
                  onKeyDown: ({ event }) => {
                    const s = slashRef.current;
                    if (!s) return false;
                    if (event.key === "Escape") {
                      showSlash(null);
                      return true;
                    }
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      const step = event.key === "ArrowDown" ? 1 : -1;
                      showSlash({
                        ...s,
                        index: (s.index + step + s.items.length) % s.items.length,
                      });
                      return true;
                    }
                    if (event.key === "Enter" || event.key === "Tab") {
                      s.pick(s.items[s.index]);
                      return true;
                    }
                    return false;
                  },
                  onExit: () => showSlash(null),
                };
              },
            }),
          ];
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: "guide-content min-h-[50vh] pb-24 outline-none",
        spellcheck: "true",
      },
      // Copies from this editor keep their blocks; anything else is cleaned (Docs, Word, web).
      transformPastedHTML: (html) => (html.includes("data-pm-slice") ? html : cleanPastedHtml(html)),
      handleKeyDown: (_view, e) => {
        // Ctrl+Shift+V: ProseMirror pastes plain text; don't turn it into Markdown either.
        plainPaste.current = e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v";
        return false;
      },
      handlePaste: (_view, event) => {
        const data = event.clipboardData;
        if (!data || !editorRef.current) return false;
        const html = data.getData("text/html");
        const files = imageFiles(data.files);
        if (!html && files.length) {
          void insertFiles(files, null);
          return true;
        }
        if (plainPaste.current) return false;
        const text = data.getData("text/plain");
        if (!html && text && looksLikeMarkdown(text)) {
          editorRef.current.commands.insertContent(markdownToDoc(text).content);
          setTimeout(() => void copyImages(), 0);
          return true;
        }
        if (html) setTimeout(() => void copyImages(), 0);
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = imageFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null;
        void insertFiles(files, pos);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON() as Doc;
      setDoc(json);
      live.current.onChange(json);
    },
  });
  /* eslint-enable react-hooks/refs */
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  async function upload(guideId: string, file: Blob): Promise<string | null> {
    const fd = new FormData();
    fd.set("image", file);
    const res = await reach(uploadGuideImage(guideId, fd));
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    return res.data.url;
  }

  /** Toolbar, slash menu, drag & drop and pasted files. */
  async function insertFiles(files: File[], pos: number | null) {
    const e = editorRef.current;
    if (!e) return;
    const guideId = await live.current.ensureGuideId();
    if (!guideId) return void toast.error("Give the guide a title first, so it can be saved.");
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) {
        toast.error("Use a JPG, PNG, WebP or GIF image.");
        continue;
      }
      if (file.size > MAX_IMAGE) {
        toast.error("Use an image under 5 MB.");
        continue;
      }
      const t = toast.loading("Uploading image…");
      const url = await upload(guideId, file);
      toast.dismiss(t);
      if (!url) continue;
      const node = { type: "image", attrs: { src: url, alt: "" } };
      if (pos === null) e.chain().focus().insertContent(node).run();
      else e.chain().focus().insertContentAt(pos, node).run();
    }
  }

  /**
   * Pasted images that aren't in guide-media yet: data/blob images are uploaded, remote ones are
   * copied by the server. Any that can't be copied are removed (the server would drop them anyway).
   */
  async function copyImages() {
    const e = editorRef.current;
    if (!e) return;
    const pending = new Set<string>();
    e.state.doc.descendants((n) => {
      const src = n.type.name === "image" ? (n.attrs.src as string) : null;
      if (src && !guideImageAllowed(src) && !copying.current.has(src)) pending.add(src);
    });
    if (!pending.size) return;
    pending.forEach((src) => copying.current.add(src));
    const guideId = await live.current.ensureGuideId();
    let failed = 0;
    await Promise.all(
      [...pending].map(async (src) => {
        let url: string | null = null;
        if (guideId) {
          if (src.startsWith("data:") || src.startsWith("blob:")) {
            const blob = await fetch(src)
              .then((r) => r.blob())
              .catch(() => null);
            if (blob && IMAGE_TYPES.includes(blob.type) && blob.size <= MAX_IMAGE) {
              const fd = new FormData();
              fd.set("image", blob);
              const res = await reach(uploadGuideImage(guideId, fd));
              if (res.ok) url = res.data.url;
            }
          } else {
            const res = await reach(importRemoteImage(guideId, src));
            if (res.ok) url = res.data.url;
          }
        }
        failed += replaceImage(e, src, url);
        copying.current.delete(src);
      }),
    );
    if (failed)
      toast.warning(
        failed === 1
          ? "1 image couldn't be copied, upload it manually."
          : `${failed} images couldn't be copied, upload them manually.`,
      );
  }

  const words = useMemo(() => wordCount(doc), [doc]);
  /* eslint-disable react-hooks/refs -- the items read these refs when one is picked (a click),
     never during render. */
  const items = useMemo(
    () => insertItems(() => fileInput.current?.click(), () => live.current.services[0]?.slug),
    [],
  );
  /* eslint-enable react-hooks/refs */

  if (!editor) return <div className="min-h-[50vh]" aria-busy />;

  return (
    <div className="flex flex-col">
      {header}
      <div className="relative flex flex-col">
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            void insertFiles(imageFiles(e.target.files), null);
            e.target.value = "";
          }}
        />
        <Toolbar
          editor={editor}
          linkOpen={linkOpen}
          setLinkOpen={setLinkOpen}
          pickImage={() => fileInput.current?.click()}
          inserter={<Inserter editor={editor} items={items} />}
        />

        <div className="pt-6">
          <EditorContent editor={editor} />
        </div>

        {slash && (
          <ul
            role="listbox"
            aria-label="Insert a block"
            style={
              // Below the cursor, or above it when there isn't room (max-h-80 is 320px).
              (slash.rect?.bottom ?? 0) + 330 > window.innerHeight
                ? {
                    position: "fixed",
                    bottom: window.innerHeight - (slash.rect?.top ?? 0) + 6,
                    left: slash.rect?.left ?? 0,
                  }
                : {
                    position: "fixed",
                    top: (slash.rect?.bottom ?? 0) + 6,
                    left: slash.rect?.left ?? 0,
                  }
            }
            className={cn(menu, "max-h-80 overflow-y-auto")}
          >
            {slash.items.map((item, i) => (
              <li
                key={item.label}
                role="option"
                aria-selected={i === slash.index}
                onMouseDown={(e) => {
                  e.preventDefault();
                  slash.pick(item);
                }}
                className={cn(menuItem, i === slash.index && "bg-surface-2")}
              >
                <item.icon className={cn(icon, "text-text-2")} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {(i === 0 || slash.items[i - 1].group !== item.group) && (
                  <span className="text-admin-meta">{item.group}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="sticky bottom-0 flex flex-wrap items-center gap-x-2 border-t border-line bg-bg py-2 text-admin-meta" aria-live="polite">
          <span className="num">
            {words.toLocaleString("en-US")} {words === 1 ? "word" : "words"}
          </span>
          <span aria-hidden>·</span>
          <span className="num">{docReadMinutes(doc)} min read</span>
        </p>
      </div>
    </div>
  );
}

/** The "+" block inserter: every block, grouped, with search. Inserts after the cursor's block. */
function Inserter({ editor, items }: { editor: Editor; items: InsertItem[] }) {
  const container = usePortalContainer();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = items.filter((i) => matches(i, q));
  const groups = (["Basic", "Guide blocks"] as const).map((g) => ({ g, list: shown.filter((i) => i.group === g) }));
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setQ("");
      }}
    >
      <Popover.Trigger title="Add a block (or type / in an empty line)" aria-label="Add a block" className={cn(btn, "bg-accent text-on-accent hover:bg-accent hover:text-on-accent")}>
        <Plus className={icon} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content align="start" sideOffset={6} className={cn(menu, "z-[70] flex w-80 flex-col gap-1 p-2")}>
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && shown[0]) {
                e.preventDefault();
                shown[0].run(editor, null);
                setOpen(false);
              }
            }}
            placeholder="Search blocks"
            aria-label="Search blocks"
            className={field}
          />
          <div className="max-h-80 overflow-y-auto">
            {groups.map(
              ({ g, list }) =>
                list.length > 0 && (
                  <div key={g} role="group" aria-label={g} className="pt-2">
                    <p className="px-2 pb-1 text-admin-meta">{g}</p>
                    {list.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          item.run(editor, null);
                          setOpen(false);
                        }}
                        className={menuItem}
                      >
                        <item.icon className={cn(icon, "text-text-2")} aria-hidden />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ),
            )}
            {!shown.length && <p className="px-2 py-3 text-admin-meta">No block matches “{q}”.</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Directory counts for the editor's directory stats blocks (admin action; same numbers as the page). */
async function loadStats(service: string): Promise<DirectoryStatsData | null> {
  const res = await reach(directoryStatsFor(service));
  return res.ok ? res.data : null;
}

/** Mounted once the editor exists, so its state is read from the start. */
function Toolbar({
  editor,
  linkOpen,
  setLinkOpen,
  pickImage,
  inserter,
}: {
  editor: Editor;
  linkOpen: boolean;
  setLinkOpen: (o: boolean) => void;
  pickImage: () => void;
  inserter: React.ReactNode;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading") ? String(e.getAttributes("heading").level) : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      table: e.isActive("table"),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-0.5 rounded-xl border border-line bg-bg p-1 shadow-sm"
    >
      {inserter}
      <Sep />
      <select
        aria-label="Block type"
        value={["p", "2", "3"].includes(state.block) ? state.block : "other"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") chain().setParagraph().run();
          else if (v === "2" || v === "3") chain().setHeading({ level: Number(v) as 2 | 3 }).run();
        }}
        className="h-8 rounded-md border border-line bg-bg px-2"
      >
        <option value="p">Paragraph</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
        {/* Older guides can have smaller headings; they're kept, just not offered. */}
        {!["p", "2", "3"].includes(state.block) && <option value="other">Heading {state.block}</option>}
      </select>
      <ToolButton
        label="Heading 2"
        keys="## space"
        icon={Heading2}
        active={state.block === "2"}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        label="Heading 3"
        keys="### space"
        icon={Heading3}
        active={state.block === "3"}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      <Sep />
      <ToolButton
        label="Bold"
        keys="Ctrl+B"
        icon={Bold}
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolButton
        label="Italic"
        keys="Ctrl+I"
        icon={Italic}
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <Sep />
      <LinkPopover editor={editor} open={linkOpen} onOpenChange={setLinkOpen} active={state.link} />
      <Sep />
      <ToolButton
        label="Bulleted list"
        keys="- space"
        icon={List}
        active={state.bullet}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolButton
        label="Numbered list"
        keys="1. space"
        icon={ListOrdered}
        active={state.ordered}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <Sep />
      <ToolButton
        label="Quote"
        keys="> space"
        icon={Quote}
        active={state.quote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <Sep />
      <TableMenu editor={editor} inTable={state.table} />
      <ToolButton
        label="Image (alt text required)"
        keys="drop or paste works too"
        icon={ImagePlus}
        active={false}
        onClick={() => pickImage()}
      />
      <Sep />
      <ToolButton
        label="Undo"
        keys="Ctrl+Z"
        icon={Undo2}
        active={false}
        disabled={!state.undo}
        onClick={() => chain().undo().run()}
      />
      <ToolButton
        label="Redo"
        keys="Ctrl+Shift+Z"
        icon={Redo2}
        active={false}
        disabled={!state.redo}
        onClick={() => chain().redo().run()}
      />
    </div>
  );
}

const imageFiles = (list: FileList | null | undefined) =>
  [...(list ?? [])].filter((f) => f.type.startsWith("image/"));

/** Points every copy of a pasted image at its upload, or removes it. Returns how many were removed. */
function replaceImage(editor: Editor, src: string, url: string | null) {
  const { tr, doc } = editor.state;
  const hits: { pos: number; size: number; attrs: Record<string, unknown> }[] = [];
  doc.descendants((n, pos) => {
    if (n.type.name === "image" && n.attrs.src === src)
      hits.push({ pos, size: n.nodeSize, attrs: n.attrs });
  });
  for (const h of hits.reverse()) {
    if (url) tr.setNodeMarkup(h.pos, undefined, { ...h.attrs, src: url });
    else tr.delete(h.pos, h.pos + h.size);
  }
  // Not an undo step: undoing shouldn't bring back the pasted original.
  if (hits.length) editor.view.dispatch(tr.setMeta("addToHistory", false));
  return url ? 0 : hits.length;
}

function Sep() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-line" />;
}

function ToolButton({
  label,
  keys,
  icon: I,
  active,
  disabled,
  onClick,
}: {
  label: string;
  keys: string;
  icon: LucideIcon;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={`${label} (${keys})`}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={btn}
    >
      <I className={icon} aria-hidden />
    </button>
  );
}

function LinkPopover({
  editor,
  open,
  onOpenChange,
  active,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  active: boolean;
}) {
  const container = usePortalContainer();
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        title="Link (Ctrl+K)"
        aria-label="Link"
        aria-pressed={active}
        className={btn}
      >
        <Link2 className={icon} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          align="start"
          sideOffset={6}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            editor.commands.focus();
          }}
          className={cn(menu, "w-80 p-3")}
        >
          <LinkForm editor={editor} active={active} done={() => onOpenChange(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Mounted each time the link popover opens, starting from the link under the cursor. */
function LinkForm({ editor, active, done }: { editor: Editor; active: boolean; done: () => void }) {
  const [href, setHref] = useState(
    () => (editor.getAttributes("link").href as string | undefined) ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    done();
  };
  const apply = () => {
    const raw = href.trim();
    if (!raw) return remove();
    // "example.com/page" → https://example.com/page
    const withScheme = /^([a-z]+:|\/|#)/i.test(raw) ? raw : `https://${raw}`;
    const clean = safeHref(withScheme);
    if (!clean) return setError("Use a web address (https://…), a path (/guides) or mailto:.");
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain
        .insertContent({
          type: "text",
          text: raw,
          marks: [{ type: "link", attrs: { href: clean } }],
        })
        .run();
    } else {
      chain.extendMarkRange("link").setLink({ href: clean }).run();
    }
    done();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="flex flex-col gap-2"
    >
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Link</span>
        <input
          autoFocus
          value={href}
          onChange={(e) => setHref(e.target.value)}
          placeholder="https://… or /guides/…"
          aria-invalid={!!error}
          className={field}
        />
      </label>
      {error && <p className="text-admin-meta text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          className="h-8 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90"
        >
          Apply
        </button>
        {active && (
          <button
            type="button"
            onClick={remove}
            className="h-8 rounded-lg border border-line px-3 font-medium hover:bg-surface-2"
          >
            Remove link
          </button>
        )}
      </div>
    </form>
  );
}

function TableMenu({ editor, inTable }: { editor: Editor; inTable: boolean }) {
  const container = usePortalContainer();
  const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => () =>
    fn(editor.chain().focus()).run();
  const items: { label: string; onSelect: () => void; danger?: boolean }[] = [
    { label: "Add row above", onSelect: run((c) => c.addRowBefore()) },
    { label: "Add row below", onSelect: run((c) => c.addRowAfter()) },
    { label: "Delete row", onSelect: run((c) => c.deleteRow()) },
    { label: "Add column left", onSelect: run((c) => c.addColumnBefore()) },
    { label: "Add column right", onSelect: run((c) => c.addColumnAfter()) },
    { label: "Delete column", onSelect: run((c) => c.deleteColumn()) },
    { label: "Toggle header row", onSelect: run((c) => c.toggleHeaderRow()) },
    { label: "Delete table", onSelect: run((c) => c.deleteTable()), danger: true },
  ];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger title="Table" aria-label="Table" aria-pressed={inTable} className={btn}>
        <Table2 className={icon} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={container}>
        <DropdownMenu.Content align="start" sideOffset={6} className={menu}>
          <DropdownMenu.Item
            className={menuItem}
            onSelect={run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
          >
            Insert table (3 × 3)
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {items.map((i) => (
            <DropdownMenu.Item
              key={i.label}
              disabled={!inTable}
              onSelect={i.onSelect}
              className={cn(menuItem, i.danger && "text-destructive")}
            >
              {i.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
