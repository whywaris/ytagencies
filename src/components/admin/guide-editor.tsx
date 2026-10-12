"use client";

import {
  ArrowUpRight,
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Table2,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SeoFields } from "@/components/admin/seo-fields";
import { usePortalContainer } from "@/components/admin/portal";
import { GuideBody } from "@/components/guide-body";
import {
  changeGuideSlug,
  deleteGuide,
  saveGuide,
  setGuideStatus,
  uploadGuideImage,
  type GuideInput,
} from "@/lib/actions/admin-guides";
import { formatDateTime } from "@/lib/format";
import { imageLinkError } from "@/lib/media";
import { cn } from "@/lib/utils";

// Two-column guide editor (ADMIN_V2_SPEC §8). Drafts autosave a few seconds after typing stops;
// leaving with unsaved changes asks first. Publishing saves first, then changes status.

export type Combo = { service_id: number; industry_id?: number; location_id?: number };
export type ComboOption = { key: string; label: string; combo: Combo };
export type AuthorOption = { id: string; name: string };

export type EditorGuide = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverPath: string | null;
  seoTitle: string;
  seoDescription: string;
  authorId: string | null;
  related: Combo[];
  keyTakeaways: string[];
  numberedSections: boolean;
  status: "draft" | "scheduled" | "published";
  publishedAt: string | null;
  /** Has been live: the URL only changes through "Change URL". */
  slugLocked: boolean;
};

type Values = GuideInput;
type SaveState = "new" | "saved" | "dirty" | "untitled" | "saving" | "error";

const AUTOSAVE_MS = 2500;
const STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/agency-media/`;
const comboKey = (c: Combo) => `${c.service_id}:${c.industry_id ?? 0}:${c.location_id ?? 0}`;
const slugPreview = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

type Tool = "h2" | "h3" | "bold" | "italic" | "link" | "ul" | "ol" | "quote" | "image" | "table";
const TOOLS: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: "h2", label: "Heading", icon: Heading2 },
  { id: "h3", label: "Subheading", icon: Heading3 },
  { id: "bold", label: "Bold", icon: Bold },
  { id: "italic", label: "Italic", icon: Italic },
  { id: "link", label: "Link", icon: Link2 },
  { id: "ul", label: "Bulleted list", icon: List },
  { id: "ol", label: "Numbered list", icon: ListOrdered },
  { id: "quote", label: "Quote", icon: Quote },
  { id: "image", label: "Image", icon: ImagePlus },
  { id: "table", label: "Table", icon: Table2 },
];

const TABLE_SNIPPET = ["| Column | Column |", "| --- | --- |", "| Cell | Cell |", ""].join("\n");

const input = "h-9 w-full rounded-lg border border-line bg-bg px-3";
const label = "flex flex-col gap-1.5";
const panel = "flex flex-col gap-3 border-b border-line pb-5 last:border-0";
const secondary =
  "h-9 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50";

export function GuideEditor({
  guide,
  comboOptions,
  authors,
  mediaHosts,
  siteHost,
}: {
  guide: EditorGuide;
  comboOptions: ComboOption[];
  authors: AuthorOption[];
  /** Image hosts allowed for the cover link (MEDIA_HOSTS). */
  mediaHosts: string[];
  siteHost: string;
}) {
  const router = useRouter();
  const [id, setId] = useState(guide.id);
  const [slug, setSlug] = useState(guide.slug);
  const [status, setStatus] = useState(guide.status);
  const [publishedAt, setPublishedAt] = useState(guide.publishedAt);
  const [values, setValues] = useState<Values>({
    title: guide.title,
    slug: guide.slug,
    excerpt: guide.excerpt,
    body: guide.body,
    coverPath: guide.coverPath,
    seoTitle: guide.seoTitle,
    seoDescription: guide.seoDescription,
    authorId: guide.authorId,
    related: guide.related,
    keyTakeaways: guide.keyTakeaways,
    numberedSections: guide.numberedSections,
  });
  const [saveState, setSaveState] = useState<SaveState>(guide.id ? "saved" : "new");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [pending, startTransition] = useTransition();
  const latest = useRef(values);
  const saving = useRef<Promise<string | null> | null>(null);
  const body = useRef<HTMLTextAreaElement>(null);

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues((s) => {
      const next = { ...s, [k]: v };
      latest.current = next;
      return next;
    });
    setSaveState("dirty");
  };

  /** Saves the latest values. Returns the guide id, or null when it couldn't save. */
  const save = useCallback(async (): Promise<string | null> => {
    if (saving.current) await saving.current;
    const snapshot = latest.current;
    if (!snapshot.title.trim()) {
      setSaveState("untitled"); // saving needs a title; typing one makes it dirty again
      return id;
    }
    const run = (async () => {
      setSaveState("saving");
      const res = await saveGuide(id, snapshot);
      if (!res.ok) {
        setSaveState("error");
        setSaveError(res.error);
        return null;
      }
      setSaveError(null);
      if (!id) {
        setId(res.data.id);
        // Stay mounted: just update the address bar to the guide's own URL.
        window.history.replaceState(null, "", `/admin/guides/${res.data.id}`);
      }
      setSlug(res.data.slug);
      setSaveState(latest.current === snapshot ? "saved" : "dirty");
      return res.data.id;
    })();
    saving.current = run;
    const result = await run;
    saving.current = null;
    return result;
  }, [id]);

  // Autosave a few seconds after the last change.
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [values, saveState, save]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (saveState === "saved" || saveState === "new") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  // ───────── Markdown toolbar ─────────
  const edit = (fn: (text: string, start: number, end: number) => [string, number, number]) => {
    const el = body.current;
    if (!el) return;
    const [text, s, e] = fn(el.value, el.selectionStart, el.selectionEnd);
    set("body", text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s, e);
    });
  };
  const wrap = (before: string, after = before, placeholder = "text") =>
    edit((t, s, e) => {
      const sel = t.slice(s, e) || placeholder;
      return [
        t.slice(0, s) + before + sel + after + t.slice(e),
        s + before.length,
        s + before.length + sel.length,
      ];
    });
  const prefixLines = (prefix: (i: number) => string) =>
    edit((t, s, e) => {
      const from = t.lastIndexOf("\n", s - 1) + 1;
      const lines = t
        .slice(from, e)
        .split("\n")
        .map((l, i) => prefix(i) + l);
      const block = lines.join("\n");
      return [t.slice(0, from) + block + t.slice(e), from, from + block.length];
    });
  const insert = (snippet: string) =>
    edit((t, s) => {
      const pad = s > 0 && t[s - 1] !== "\n" ? "\n\n" : "";
      const text = t.slice(0, s) + pad + snippet + t.slice(s);
      const at = s + pad.length + snippet.length;
      return [text, at, at];
    });

  // Inline images upload to storage; the cover is a pasted link (CoverField).
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = () => fileInput.current?.click();
  const onFile = (file: File | undefined) => {
    if (!file) return;
    startTransition(async () => {
      const guideId = id ?? (await save());
      if (!guideId) return void toast.error("Give the guide a title first, so it can be saved.");
      const fd = new FormData();
      fd.set("image", file);
      const res = await uploadGuideImage(guideId, fd);
      if (!res.ok) return void toast.error(res.error);
      insert(`![Describe the image](${res.data.url})\n`);
    });
    if (fileInput.current) fileInput.current.value = "";
  };

  const runTool = (tool: Tool) => {
    if (tool === "h2") prefixLines(() => "## ");
    else if (tool === "h3") prefixLines(() => "### ");
    else if (tool === "bold") wrap("**");
    else if (tool === "italic") wrap("_");
    else if (tool === "link") wrap("[", "](https://)", "link text");
    else if (tool === "ul") prefixLines(() => "- ");
    else if (tool === "ol") prefixLines((i) => `${i + 1}. `);
    else if (tool === "quote") prefixLines(() => "> ");
    else if (tool === "image") upload();
    else insert(TABLE_SNIPPET);
  };

  // ───────── Status ─────────
  const [scheduleAt, setScheduleAt] = useState("");
  const changeStatus = (
    raw: { action: "publish" | "unpublish" } | { action: "schedule"; at: string },
  ) =>
    startTransition(async () => {
      const guideId = await save();
      if (!guideId) return void toast.error(saveError ?? "Save the guide first.");
      const res = await setGuideStatus(guideId, raw);
      if (!res.ok) return void toast.error(res.error);
      setStatus(res.data.status as EditorGuide["status"]);
      if (raw.action === "schedule") setPublishedAt(raw.at);
      if (raw.action === "publish" && !publishedAt) setPublishedAt(new Date().toISOString());
      toast.success(
        raw.action === "publish"
          ? "Published"
          : raw.action === "schedule"
            ? "Scheduled"
            : "Moved back to draft",
      );
      router.refresh();
    });

  const live = status !== "draft" && !!publishedAt && new Date(publishedAt) <= new Date();
  const locked = guide.slugLocked || live;
  const shownSlug = slug || slugPreview(values.title) || "your-guide";
  const seoTitle = values.seoTitle || `${values.title || "Guide title"} | YT Agencies`;
  const seoDescription = values.seoDescription || values.excerpt;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {/* ───────── Left: content ───────── */}
      <div className="flex min-w-0 flex-col gap-5">
        <label className={label}>
          <span className="sr-only">Title</span>
          <input
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Guide title"
            maxLength={200}
            className="w-full bg-transparent text-admin-title outline-none placeholder:text-text-2"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 text-text-2">
          <span className="num">{siteHost}/guides/</span>
          {locked ? (
            <>
              <span className="text-text">{slug}</span>
              <ChangeUrl
                guideId={id!}
                current={slug}
                onChanged={(s) => {
                  setSlug(s);
                  router.refresh();
                }}
              />
            </>
          ) : (
            <input
              aria-label="URL"
              value={values.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase())}
              placeholder={shownSlug}
              className="h-8 min-w-48 flex-1 rounded-md border border-line bg-bg px-2 text-text"
            />
          )}
        </div>

        <div className="flex flex-col rounded-xl border border-line">
          <div
            role="toolbar"
            aria-label="Formatting"
            className="flex flex-wrap items-center gap-0.5 border-b border-line p-1"
          >
            {TOOLS.map((t) => (
              <button
                key={t.label}
                type="button"
                title={t.label}
                aria-label={t.label}
                disabled={pending}
                onClick={() => runTool(t.id)}
                className="flex size-8 items-center justify-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text disabled:opacity-50"
              >
                <t.icon className="size-4 [stroke-width:1.5]" aria-hidden />
              </button>
            ))}
            <label className="ml-auto flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-text-2 hover:text-text">
              <input
                type="checkbox"
                checked={preview}
                onChange={(e) => setPreview(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Preview
            </label>
          </div>
          <div className={cn("grid min-h-[60vh]", preview && "lg:grid-cols-2")}>
            <textarea
              ref={body}
              aria-label="Guide text (Markdown)"
              value={values.body}
              onChange={(e) => set("body", e.target.value)}
              spellCheck
              placeholder={
                "Write in Markdown.\n\n## A heading\n\nA paragraph with **bold** and a [link](/guides).\n\n{{budget-range youtube-ads-agencies}} on its own line adds the live budget box."
              }
              className="min-h-[60vh] w-full resize-y bg-transparent p-4 font-[inherit] leading-6 outline-none"
            />
            {preview && (
              <div
                aria-label="Preview"
                className="min-w-0 border-t border-line p-4 text-[17px] leading-relaxed lg:border-t-0 lg:border-l"
              >
                <GuideBody
                  md={values.body}
                  budgetRange={(service) => (
                    <p className="mb-5 rounded-lg bg-surface p-4 text-text-2">
                      Live budget box for {service}: real figures appear on the published page.
                    </p>
                  )}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ───────── Right: settings ───────── */}
      <aside className="flex flex-col gap-5 xl:sticky xl:top-20 xl:self-start">
        <section aria-label="Status" className={panel}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">
              {status === "draft"
                ? "Draft"
                : status === "scheduled" && !live
                  ? "Scheduled"
                  : "Published"}
            </p>
            <SaveIndicator state={saveState} error={saveError} />
          </div>
          {status === "scheduled" && !live && publishedAt && (
            <p className="text-admin-meta num">Goes live {formatDateTime(publishedAt)}</p>
          )}
          {live && publishedAt && (
            <p className="text-admin-meta num">Live since {formatDateTime(publishedAt)}</p>
          )}
          {status === "draft" ? (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => changeStatus({ action: "publish" })}
                className="h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
              >
                Publish guide
              </button>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  aria-label="Publish at"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className={cn(input, "num")}
                />
                <button
                  type="button"
                  disabled={pending || !scheduleAt}
                  onClick={() =>
                    changeStatus({ action: "schedule", at: new Date(scheduleAt).toISOString() })
                  }
                  className={secondary}
                >
                  Schedule
                </button>
              </div>
            </div>
          ) : (
            <ConfirmDialog
              trigger={
                <button type="button" disabled={pending} className={cn(secondary, "self-start")}>
                  {live ? "Unpublish…" : "Cancel schedule…"}
                </button>
              }
              title={live ? "Unpublish this guide?" : "Cancel the schedule?"}
              description={
                live
                  ? "It goes back to draft and its page stops working until you publish it again. The URL is kept."
                  : "It goes back to draft and won't go live."
              }
              confirmLabel={live ? "Unpublish" : "Cancel schedule"}
              onConfirm={async () => {
                changeStatus({ action: "unpublish" });
                return null;
              }}
            />
          )}
        </section>

        <CoverField
          value={values.coverPath}
          hosts={mediaHosts}
          onChange={(v) => set("coverPath", v)}
        />

        <section aria-label="Summary and search" className={panel}>
          <Counted
            label="Excerpt"
            value={values.excerpt}
            max={300}
            hint="Shown on the guides page."
          >
            <textarea
              value={values.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              maxLength={300}
              rows={3}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2"
            />
          </Counted>
          <SeoFields
            title={values.seoTitle}
            description={values.seoDescription}
            onTitle={(v) => set("seoTitle", v)}
            onDescription={(v) => set("seoDescription", v)}
            shownTitle={seoTitle}
            shownDescription={seoDescription}
            breadcrumb={`${siteHost} › guides › ${shownSlug}`}
            titleHint="Empty uses the title."
            descriptionHint="Empty uses the excerpt."
          />
        </section>

        <section aria-label="Author" className={panel}>
          <label className={label}>
            <span className="font-medium">Author</span>
            <select
              value={values.authorId ?? ""}
              onChange={(e) => set("authorId", e.target.value || null)}
              className={input}
            >
              <option value="">No author</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <span className="text-admin-meta">
              Shown in the byline and the author box.{" "}
              {/* New tab: leaving here mid-edit would skip the unsaved-changes warning. */}
              <Link
                href="/admin/authors"
                target="_blank"
                rel="noopener"
                className="text-accent hover:underline"
              >
                Manage authors
              </Link>
            </span>
          </label>
        </section>

        <section aria-label="Article options" className={panel}>
          <label className={label}>
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-medium">Key takeaways</span>
              <span
                className={cn(
                  "text-admin-meta num",
                  values.keyTakeaways.filter((l) => l.trim()).length > 5 && "text-destructive",
                )}
              >
                {values.keyTakeaways.filter((l) => l.trim()).length} / 5
              </span>
            </span>
            <textarea
              value={values.keyTakeaways.join("\n")}
              onChange={(e) => set("keyTakeaways", e.target.value.split("\n"))}
              rows={4}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2"
            />
            <span className="text-admin-meta">One per line. Shown in a box above the article.</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={values.numberedSections}
              onChange={(e) => set("numberedSections", e.target.checked)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span className="flex flex-col">
              <span className="font-medium">Numbered sections</span>
              <span className="text-admin-meta">
                For lists and step-by-step guides: numbers each main heading.
              </span>
            </span>
          </label>
        </section>

        <RelatedPicker
          options={comboOptions}
          value={values.related}
          onChange={(related) => set("related", related)}
        />

        <section aria-label="Links" className="flex flex-col gap-2">
          {id && (
            <a
              href={`/admin/guides/${id}/preview`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 self-start text-accent hover:underline"
            >
              Preview as page
              <ArrowUpRight className="size-4 [stroke-width:1.5]" aria-hidden />
            </a>
          )}
          {live && (
            <a
              href={`/guides/${slug}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 self-start hover:underline"
            >
              View live
              <ArrowUpRight className="size-4 [stroke-width:1.5] text-text-2" aria-hidden />
            </a>
          )}
          {id && (
            <ConfirmDialog
              trigger={
                <button
                  type="button"
                  className="self-start text-text-2 hover:text-destructive hover:underline"
                >
                  Delete guide…
                </button>
              }
              title={`Delete "${values.title || "this guide"}"?`}
              description={
                live
                  ? "The guide and its page are removed for good, and its URL starts returning 404."
                  : "The guide is removed for good."
              }
              confirmLabel="Delete guide"
              onConfirm={async () => {
                const res = await deleteGuide(id);
                if (!res.ok) return res.error;
                setSaveState("saved");
                toast.success("Guide deleted");
                router.push("/admin/guides");
                return null;
              }}
            />
          )}
        </section>
      </aside>
    </div>
  );
}

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  const text = {
    new: "Not saved yet",
    saved: "Saved",
    dirty: "Unsaved changes",
    untitled: "Add a title to save",
    saving: "Saving…",
    error: "Couldn't save",
  }[state];
  return (
    <span
      role="status"
      title={state === "error" ? (error ?? undefined) : undefined}
      className={cn("text-admin-meta", state === "error" && "text-destructive")}
    >
      {text}
    </span>
  );
}

function Counted({
  label: name,
  value,
  max,
  hard,
  hint,
  children,
}: {
  label: string;
  value: string;
  max: number;
  hard?: number;
  hint: string;
  children: React.ReactNode;
}) {
  const over = value.length > max;
  return (
    <label className={label}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{name}</span>
        <span className={cn("text-admin-meta num", over && "text-warning")}>
          {value.length} / {max}
        </span>
      </span>
      {children}
      <span className="text-admin-meta">
        {over && hard ? `Over ${max}, search engines may cut it short. ` : ""}
        {hint}
      </span>
    </label>
  );
}

function RelatedPicker({
  options,
  value,
  onChange,
}: {
  options: ComboOption[];
  value: Combo[];
  onChange: (v: Combo[]) => void;
}) {
  const [q, setQ] = useState("");
  const chosen = new Set(value.map(comboKey));
  const byKey = new Map(options.map((o) => [o.key, o]));
  const matches = q.trim()
    ? options
        .filter((o) => !chosen.has(o.key) && o.label.toLowerCase().includes(q.trim().toLowerCase()))
        .slice(0, 8)
    : [];
  return (
    <section aria-label="Related directory pages" className={panel}>
      <p className="font-medium">Related directory pages</p>
      {value.length > 0 && (
        <ul className="flex flex-col gap-1">
          {value.map((c) => (
            <li key={comboKey(c)} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">
                {byKey.get(comboKey(c))?.label ?? "Removed page"}
              </span>
              <button
                type="button"
                aria-label={`Remove ${byKey.get(comboKey(c))?.label ?? "page"}`}
                onClick={() => onChange(value.filter((x) => comboKey(x) !== comboKey(c)))}
                className="flex size-7 items-center justify-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"
              >
                <X className="size-4 [stroke-width:1.5]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="search"
        aria-label="Find a directory page"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a page, e.g. Ads for doctors"
        className={input}
        disabled={value.length >= 10}
      />
      {matches.length > 0 && (
        <ul className="flex flex-col rounded-lg border border-line p-1">
          {matches.map((o) => (
            <li key={o.key}>
              <button
                type="button"
                onClick={() => {
                  onChange([...value, o.combo]);
                  setQ("");
                }}
                className="flex h-8 w-full items-center rounded-md px-2 text-left hover:bg-surface-2"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-admin-meta">Linked at the end of the guide. Pick 2 or 3.</p>
    </section>
  );
}

function ChangeUrl({
  guideId,
  current,
  onChanged,
}: {
  guideId: string;
  current: string;
  onChanged: (slug: string) => void;
}) {
  const container = usePortalContainer();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setSlug(current);
          setError(null);
        }
      }}
    >
      <Dialog.Trigger className="text-accent hover:underline">Change URL…</Dialog.Trigger>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-line bg-bg p-6 text-text shadow-lg outline-none"
        >
          <Dialog.Title className="text-admin-section">Change the guide&apos;s URL</Dialog.Title>
          <p className="text-text-2">
            The old URL, /guides/{current}, keeps working: it redirects permanently to the new one.
          </p>
          <label className={label}>
            <span className="font-medium">New URL</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className={input}
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Dialog.Close className={secondary}>Cancel</Dialog.Close>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await changeGuideSlug(guideId, slug);
                  if (!res.ok) return setError(res.error);
                  toast.success("URL changed. The old one redirects.");
                  setOpen(false);
                  onChanged(res.data.slug);
                })
              }
              className="h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
            >
              Change URL
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Cover image as a link to an image hosted on Cloudflare (MEDIA_HOSTS). Applied when the field
 * loses focus or on Enter, so autosave never sends a half-typed link. Older covers uploaded to
 * storage still show and can be replaced.
 */
function CoverField({
  value,
  hosts,
  onChange,
}: {
  value: string | null;
  hosts: string[];
  onChange: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const src = value ? (value.startsWith("https://") ? value : STORAGE + value) : null;

  const apply = () => {
    const link = draft.trim();
    if (link === (value ?? "")) return setError(null);
    if (!link) {
      setError(null);
      return onChange(null);
    }
    const problem = imageLinkError(link, hosts);
    setError(problem);
    if (!problem) onChange(link);
  };

  return (
    <section aria-label="Cover image" className={panel}>
      <label className={label}>
        <span className="font-medium">Cover image</span>
        <input
          type="url"
          inputMode="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          placeholder={hosts[0] ? `https://${hosts[0]}/…` : "https://…"}
          aria-invalid={!!error}
          aria-describedby="cover-help"
          className={input}
        />
      </label>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of the linked image
        <img
          src={src}
          alt=""
          className="aspect-video w-full rounded-lg border border-line object-cover"
        />
      )}
      {value && (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            setError(null);
            onChange(null);
          }}
          className={cn(secondary, "self-start")}
        >
          Remove cover
        </button>
      )}
      <p id="cover-help" className={cn("text-admin-meta", error && "text-destructive")}>
        {error ??
          (hosts.length
            ? `Paste a link to an image on ${hosts.join(" or ")}. 1600 × 900 (16:9) works best; it's the social image too. Without one, a cover is made from the title.`
            : "Image links aren't set up yet: add your Cloudflare image host to MEDIA_HOSTS. Without a cover, one is made from the title.")}
      </p>
    </section>
  );
}
