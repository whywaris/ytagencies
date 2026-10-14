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
  Bold,
  ChevronRight,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Settings2,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { DropdownMenu, Popover } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { usePortalContainer } from "@/components/admin/portal";
import { importRemoteImage, uploadGuideImage } from "@/lib/actions/admin-guides";
import {
  cleanPastedHtml,
  docOutline,
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
      className={cn(
        "my-6 flex flex-col gap-2",
        selected && "outline-2 outline-offset-4 outline-accent",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- editor canvas, not a page */}
      <img
        src={src}
        alt={alt}
        data-drag-handle
        className={cn("w-full rounded-xl border border-line", uploading && "opacity-50")}
      />
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

// ───────── Slash menu ─────────

type SlashItem = {
  label: string;
  icon: LucideIcon;
  run: (editor: Editor, range: Range) => void;
};
type SlashState = {
  items: SlashItem[];
  index: number;
  rect: DOMRect | null;
  pick: (i: SlashItem) => void;
};

function slashItems(pickImage: () => void, firstService: () => string | undefined): SlashItem[] {
  const heading = (level: 2 | 3 | 4, label: string, i: LucideIcon): SlashItem => ({
    label,
    icon: i,
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level }).run(),
  });
  return [
    heading(2, "Heading 2", Heading2),
    heading(3, "Heading 3", Heading3),
    heading(4, "Heading 4", Heading4),
    {
      label: "Bullet list",
      icon: List,
      run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
    },
    {
      label: "Table",
      icon: Table2,
      run: (e, r) =>
        e
          .chain()
          .focus()
          .deleteRange(r)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      label: "Image",
      icon: ImagePlus,
      run: (e, r) => {
        e.chain().focus().deleteRange(r).run();
        pickImage();
      },
    },
    {
      label: "Quote",
      icon: Quote,
      run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
    },
    {
      label: "Divider",
      icon: Minus,
      run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
    },
    {
      label: "Budget range",
      icon: Wallet,
      run: (e, r) => {
        const service = firstService();
        if (!service) return void toast.error("Add a service first.");
        e.chain()
          .focus()
          .deleteRange(r)
          .insertContent({ type: "embed", attrs: { kind: "budget-range", service } })
          .run();
      },
    },
  ];
}

// ───────── Editor ─────────

export function RichEditor({
  initial,
  services,
  status,
  ensureGuideId,
  onChange,
}: {
  initial: Doc;
  services: ServiceOption[];
  /** "Saved", "Saving…", "Unsaved changes"… */
  status: React.ReactNode;
  /** Saves the guide if it's new; uploads need its id. */
  ensureGuideId: () => Promise<string | null>;
  onChange: (doc: Doc) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const slashRef = useRef<SlashState | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const plainPaste = useRef(false);
  const copying = useRef(new Set<string>());
  const [doc, setDoc] = useState(initial);
  // Callbacks the extensions call; refs so the editor is built once.
  const live = useRef({ ensureGuideId, onChange, services });
  useEffect(() => {
    live.current = { ensureGuideId, onChange, services };
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
      Placeholder.configure({ placeholder: "Write, or type / for blocks" }),
      Extension.create({
        name: "guideShortcuts",
        addKeyboardShortcuts: () => ({
          "Mod-k": () => {
            setLinkOpen(true);
            return true;
          },
        }),
      }),
      Extension.create({
        name: "slashMenu",
        addProseMirrorPlugins() {
          const items = slashItems(
            () => fileInput.current?.click(),
            () => live.current.services[0]?.slug,
          );
          return [
            Suggestion<SlashItem, SlashItem>({
              editor: this.editor,
              char: "/",
              startOfLine: true,
              allow: ({ state, range }) => {
                const $from = state.doc.resolve(range.from);
                return $from.parent.type.name === "paragraph" && $from.depth === 1;
              },
              items: ({ query }) =>
                items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
              command: ({ editor: e, range, props }) => props.run(e, range),
              render: () => {
                const update = (p: {
                  items: SlashItem[];
                  command: (i: SlashItem) => void;
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
        class: "guide-prose min-h-[60vh] px-4 py-6 outline-none sm:px-8",
        spellcheck: "true",
      },
      transformPastedHTML: (html) => cleanPastedHtml(html),
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
  const outline = useMemo(() => docOutline(doc), [doc]);

  if (!editor) return <div className="min-h-[60vh] rounded-xl border border-line" aria-busy />;

  const jump = (index: number) => {
    let pos = -1;
    editor.state.doc.forEach((_n, offset, i) => {
      if (i === index) pos = offset;
    });
    if (pos < 0) return;
    editor
      .chain()
      .focus()
      .setTextSelection(pos + 1)
      .run();
    (editor.view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({ block: "center" });
  };

  return (
    <div className="flex flex-col gap-3">
      {outline.length > 0 && (
        <details className="group rounded-xl border border-line">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-4 font-medium select-none [&::-webkit-details-marker]:hidden">
            <ChevronRight
              className="size-4 [stroke-width:1.5] text-text-2 transition-transform duration-150 group-open:rotate-90"
              aria-hidden
            />
            Outline
            <span className="text-admin-meta num">{outline.length}</span>
          </summary>
          <ol className="flex flex-col px-2 pb-2">
            {outline.map((h) => (
              <li key={h.index}>
                <button
                  type="button"
                  onClick={() => jump(h.index)}
                  style={{ paddingLeft: `${(h.level - 2) * 16 + 8}px` }}
                  className={cn(
                    "flex min-h-8 w-full items-center rounded-md pr-2 text-left hover:bg-surface-2",
                    h.level > 2 && "text-text-2",
                  )}
                >
                  {h.text || "Untitled heading"}
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}
      <div className="flex flex-col rounded-xl border border-line">
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
        />

        <EditorContent editor={editor} />

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
                {item.label}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-x-2 border-t border-line px-4 py-2 text-admin-meta">
          <span className="num">
            {words.toLocaleString("en-US")} {words === 1 ? "word" : "words"}
          </span>
          <span aria-hidden>·</span>
          <span className="num">{docReadMinutes(doc)} min read</span>
          <span aria-hidden>·</span>
          {status}
        </div>
      </div>
    </div>
  );
}

/** Mounted once the editor exists, so its state is read from the start. */
function Toolbar({
  editor,
  linkOpen,
  setLinkOpen,
  pickImage,
}: {
  editor: Editor;
  linkOpen: boolean;
  setLinkOpen: (o: boolean) => void;
  pickImage: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading") ? String(e.getAttributes("heading").level) : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
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
      className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-line bg-bg p-1"
    >
      <select
        aria-label="Block type"
        value={state.block}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") chain().setParagraph().run();
          else
            chain()
              .setHeading({ level: Number(v) as 2 | 3 | 4 | 5 | 6 })
              .run();
        }}
        className="h-8 rounded-md border border-line bg-bg px-2"
      >
        <option value="p">Paragraph</option>
        {[2, 3, 4, 5, 6].map((l) => (
          <option key={l} value={l}>
            Heading {l}
          </option>
        ))}
      </select>
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
      <ToolButton
        label="Underline"
        keys="Ctrl+U"
        icon={Underline}
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolButton
        label="Strikethrough"
        keys="Ctrl+Shift+S"
        icon={Strikethrough}
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <Sep />
      <LinkPopover editor={editor} open={linkOpen} onOpenChange={setLinkOpen} active={state.link} />
      <Sep />
      <ToolButton
        label="Bullet list"
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
      <ToolButton
        label="Divider"
        keys="---"
        icon={Minus}
        active={false}
        onClick={() => chain().setHorizontalRule().run()}
      />
      <Sep />
      <TableMenu editor={editor} inTable={state.table} />
      <ToolButton
        label="Image"
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
