"use client";

import {
  Node as TiptapNode,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { Pencil, Trash2 } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";

import { BlockForm, type FormContext } from "@/components/admin/block-form";
import { usePortalContainer } from "@/components/admin/portal";
import { GuideBlockView, type DirectoryStatsData } from "@/components/guide-blocks";
import {
  BLOCK_TYPES,
  BLOCKS,
  blockText,
  type BlockAttrs,
  type BlockType,
} from "@/lib/guide-blocks";
import { guideBlocks, type Doc } from "@/lib/guide-content";
import { guideImageAllowed } from "@/lib/guide-media";
import { cn } from "@/lib/utils";

// Guide blocks in the editor: one atom node per block type (lib/guide-blocks.ts), shown with the
// same component as the public page (components/guide-blocks.tsx) and edited in a dialog.

export type BlockNodeOptions = {
  services: () => { slug: string; name: string }[];
  upload: (file: File) => Promise<string | null>;
  stats: (service: string) => Promise<DirectoryStatsData | null>;
};

// The block just inserted from the inserter opens its form straight away.
let openNext = false;
export const openNextBlock = () => {
  openNext = true;
};
const consumeOpenNext = () => {
  const v = openNext;
  openNext = false;
  return v;
};

const tool =
  "flex h-8 items-center gap-1.5 rounded-md bg-bg px-2 text-[13px] font-medium text-text-2 shadow-sm ring-1 ring-line hover:text-text focus-visible:outline-2 focus-visible:outline-accent";

function BlockNodeView({ node, updateAttributes, deleteNode, selected, editor, getPos, extension }: ReactNodeViewProps) {
  const type = node.type.name as BlockType;
  const def = BLOCKS[type];
  const options = extension.options as BlockNodeOptions;
  const attrs = node.attrs as BlockAttrs;
  const container = usePortalContainer();
  const [open, setOpen] = useState(consumeOpenNext);
  const [draft, setDraft] = useState<BlockAttrs>(attrs);

  // A product card's number among product cards, kept current as cards move.
  const number = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (type !== "productCard") return undefined;
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (pos === undefined) return undefined;
      let n = 0;
      e.state.doc.forEach((child, offset) => {
        if (child.type.name === "productCard" && offset <= pos) n++;
      });
      return n;
    },
  });

  const stats = useStats(type === "directoryStats" ? String(attrs.service ?? "") : null, options.stats);
  const empty = type !== "directoryStats" && !blockText(type, attrs).trim();

  const context: FormContext = {
    anchors: open
      ? guideBlocks(editor.getJSON() as Doc, guideImageAllowed).outline.map((o) => ({ id: o.id, label: o.text }))
      : [],
    services: options.services(),
    upload: options.upload,
  };

  return (
    <NodeViewWrapper
      data-guide-block={type}
      contentEditable={false}
      className={cn(
        "guide-block group/block relative my-6 rounded-2xl",
        selected && "outline-2 outline-offset-4 outline-accent",
      )}
    >
      <div
        data-drag-handle
        className="absolute -top-4 right-2 z-10 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/block:opacity-100 group-focus-within/block:opacity-100 [.ProseMirror-selectednode>&]:opacity-100"
      >
        <span className="rounded-md bg-bg px-2 py-1 text-[12px] text-text-2 ring-1 ring-line">{def.label}</span>
        <button
          type="button"
          className={tool}
          onClick={() => {
            setDraft(attrs);
            setOpen(true);
          }}
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit<span className="sr-only"> {def.label}</span>
        </button>
        <button type="button" className={tool} onClick={deleteNode} aria-label={`Remove ${def.label}`}>
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>

      {empty ? (
        <button
          type="button"
          onClick={() => {
            setDraft(attrs);
            setOpen(true);
          }}
          className="flex w-full flex-col items-start gap-1 rounded-2xl border border-dashed border-line px-5 py-6 text-left hover:border-text-2"
        >
          <span className="font-semibold">{def.label}</span>
          <span className="text-admin-meta">{def.description} Click to fill it in.</span>
        </button>
      ) : (
        <GuideBlockView type={type} attrs={attrs} number={number} stats={stats} editing />
      )}

      <Dialog.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setDraft(attrs);
        }}
      >
        <Dialog.Portal container={container}>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/30" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-[70] flex max-h-[calc(100vh-48px)] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-bg text-text shadow-lg outline-none"
          >
            <Dialog.Title className="border-b border-line px-6 py-4 text-admin-section">Edit {def.label.toLowerCase()}</Dialog.Title>
            <div className="overflow-y-auto px-6 py-5">
              <BlockForm fields={def.fields} value={draft} onChange={setDraft} context={context} />
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
              <Dialog.Close className="h-9 rounded-lg border border-line px-3 font-medium hover:bg-surface-2">Cancel</Dialog.Close>
              <button
                type="button"
                onClick={() => {
                  // Plain JSON: attributes go straight into the document.
                  updateAttributes(JSON.parse(JSON.stringify(draft)) as BlockAttrs);
                  setOpen(false);
                  editor.commands.focus();
                }}
                className="h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90"
              >
                Apply
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </NodeViewWrapper>
  );
}

/** The live counts for a directory stats block in the editor (the same numbers the page shows). */
function useStats(service: string | null, load: BlockNodeOptions["stats"]) {
  const [stats, setStats] = useState<DirectoryStatsData | null>(null);
  useEffect(() => {
    if (service === null) return;
    let cancelled = false;
    load(service).then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [service, load]);
  return stats;
}

/** One Tiptap node per guide block; every field is an attribute, kept as plain JSON. */
export const guideBlockNodes = (options: BlockNodeOptions) =>
  BLOCK_TYPES.map((type) => {
    const empty = BLOCKS[type].empty();
    return TiptapNode.create<BlockNodeOptions>({
      name: type,
      group: "block",
      atom: true,
      draggable: true,
      selectable: true,
      addOptions: () => options,
      addAttributes: () =>
        Object.fromEntries(
          BLOCKS[type].fields.map((f) => [f.key, { default: empty[f.key], rendered: false }]),
        ),
      // Copy and paste inside the editor carries the attributes as JSON.
      parseHTML: () => [
        {
          tag: `div[data-guide-block="${type}"]`,
          getAttrs: (el) => {
            try {
              return JSON.parse((el as HTMLElement).getAttribute("data-attrs") ?? "{}");
            } catch {
              return {};
            }
          },
        },
      ],
      renderHTML: ({ node }) => ["div", { "data-guide-block": type, "data-attrs": JSON.stringify(node.attrs) }],
      addNodeView: () => ReactNodeViewRenderer(BlockNodeView),
    });
  });
