"use client";

import { ArrowUpRight, ChevronDown, ImagePlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SeoFields } from "@/components/admin/seo-fields";
import { usePortalContainer } from "@/components/admin/portal";
import { reach, RichEditor, type ServiceOption } from "@/components/admin/rich-editor";
import {
  changeGuideSlug,
  deleteGuide,
  discardGuideDraft,
  saveGuide,
  setGuideStatus,
  uploadGuideImage,
  type GuideInput,
} from "@/lib/actions/admin-guides";
import { formatDateTime } from "@/lib/format";
import type { Doc } from "@/lib/guide-content";
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
  body: Doc;
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
  /** Live, with unpublished changes. */
  hasDraft: boolean;
};

type Values = Omit<GuideInput, "body"> & { body: Doc };
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

const input = "h-9 w-full rounded-lg border border-line bg-bg px-3";
const label = "flex flex-col gap-1.5";
const primary =
  "h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90 disabled:opacity-50";
const secondary =
  "h-9 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50";

export function GuideEditor({
  guide,
  comboOptions,
  authors,
  siteHost,
  services,
}: {
  guide: EditorGuide;
  comboOptions: ComboOption[];
  authors: AuthorOption[];
  siteHost: string;
  /** For the budget range block. */
  services: ServiceOption[];
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
  const [hasDraft, setHasDraft] = useState(guide.hasDraft);
  const [pending, startTransition] = useTransition();
  const latest = useRef(values);
  const saving = useRef<Promise<string | null> | null>(null);

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
      const res = await reach(saveGuide(id, snapshot));
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
      setHasDraft(res.data.draft);
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

  // ───────── Publish ─────────
  const [scheduleAt, setScheduleAt] = useState("");
  const live = status !== "draft" && !!publishedAt && new Date(publishedAt) <= new Date();
  const changeStatus = (
    raw: { action: "publish" | "unpublish" } | { action: "schedule"; at: string },
  ) =>
    startTransition(async () => {
      const guideId = await save();
      if (!guideId) return void toast.error(saveError ?? "Save the guide first.");
      const res = await reach(setGuideStatus(guideId, raw));
      if (!res.ok) return void toast.error(res.error);
      setStatus(res.data.status as EditorGuide["status"]);
      if (raw.action !== "unpublish") setHasDraft(false);
      if (raw.action === "schedule") setPublishedAt(raw.at);
      if (raw.action === "publish" && !publishedAt) setPublishedAt(new Date().toISOString());
      toast.success(
        raw.action === "publish"
          ? live
            ? "Updated"
            : "Published"
          : raw.action === "schedule"
            ? "Scheduled"
            : "Moved back to draft",
      );
      router.refresh();
    });

  const locked = guide.slugLocked || live;
  const shownSlug = slug || slugPreview(values.title) || "your-guide";
  const titleFallback = `${values.title || "Guide title"} | YT Agencies`;
  const seoTitle = values.seoTitle || titleFallback;
  const seoDescription = values.seoDescription || values.excerpt;
  const changed = hasDraft || saveState === "dirty" || saveState === "saving";

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
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

        <RichEditor
          initial={guide.body}
          services={services}
          status={<SaveIndicator state={saveState} error={saveError} />}
          ensureGuideId={async () => id ?? (await save())}
          onChange={(doc) => set("body", doc)}
        />
      </div>

      {/* ───────── Right: settings ───────── */}
      <aside className="flex min-w-0 flex-col gap-3">
        <Group title="Publish" className="z-20 xl:sticky xl:top-[72px]">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">
              {status === "draft" ? "Draft" : live ? "Published" : "Scheduled"}
            </p>
            <SaveIndicator state={saveState} error={saveError} />
          </div>
          {status === "scheduled" && !live && publishedAt && (
            <p className="text-admin-meta num">Goes live {formatDateTime(publishedAt)}</p>
          )}
          {live && publishedAt && (
            <p className="text-admin-meta num">Live since {formatDateTime(publishedAt)}</p>
          )}
          {live && changed && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
              <span className="text-warning">Unpublished changes</span>
              {hasDraft && id && (
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      disabled={pending}
                      className="text-accent hover:underline"
                    >
                      Discard changes
                    </button>
                  }
                  title="Discard the unpublished changes?"
                  description="The editor goes back to what's live now. This can't be undone."
                  confirmLabel="Discard changes"
                  onConfirm={async () => {
                    if (saving.current) await saving.current;
                    const res = await reach(discardGuideDraft(id));
                    if (!res.ok) return res.error;
                    setHasDraft(false);
                    setSaveState("saved");
                    toast.success("Changes discarded");
                    router.refresh();
                    return null;
                  }}
                />
              )}
            </div>
          )}

          {status === "draft" ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => changeStatus({ action: "publish" })}
                className={primary}
              >
                Publish
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
            </>
          ) : (
            <button
              type="button"
              disabled={pending || (live && !changed)}
              onClick={() => changeStatus({ action: "publish" })}
              className={primary}
            >
              {live ? "Update" : "Publish now"}
            </button>
          )}

          {(id || live) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {id && (
                <a
                  href={`/admin/guides/${id}/preview`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  Preview
                  <ArrowUpRight className="size-4 [stroke-width:1.5]" aria-hidden />
                </a>
              )}
              {live && (
                <a
                  href={`/guides/${slug}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  View live
                  <ArrowUpRight className="size-4 [stroke-width:1.5] text-text-2" aria-hidden />
                </a>
              )}
              {status !== "draft" && (
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      disabled={pending}
                      className="ml-auto text-text-2 hover:text-text hover:underline"
                    >
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
            </div>
          )}
        </Group>

        <Group title="SEO">
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
            titlePlaceholder={titleFallback}
            descriptionPlaceholder={values.excerpt}
          />
        </Group>

        <Group title="Cover & excerpt">
          <CoverField
            value={values.coverPath}
            onChange={(v) => set("coverPath", v)}
            ensureGuideId={async () => id ?? (await save())}
          />
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
        </Group>

        <Group title="Author">
          <label className={label}>
            <span className="sr-only">Author</span>
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
        </Group>

        <Group title="Key takeaways & sections">
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
        </Group>

        <Group title="Related directory pages">
          <RelatedPicker
            options={comboOptions}
            value={values.related}
            onChange={(related) => set("related", related)}
          />
        </Group>

        {id && (
          <ConfirmDialog
            trigger={
              <button
                type="button"
                className="mt-2 self-start px-1 text-destructive hover:underline"
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
              const res = await reach(deleteGuide(id));
              if (!res.ok) return res.error;
              setSaveState("saved");
              toast.success("Guide deleted");
              router.push("/admin/guides");
              return null;
            }}
          />
        )}
      </aside>
    </div>
  );
}

/** A collapsible sidebar group, open by default. */
function Group({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details open className={cn("group rounded-xl border border-line bg-bg", className)}>
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 font-medium select-none [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          className="size-4 [stroke-width:1.5] text-text-2 transition-transform duration-150 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
    </details>
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
    <>
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
    </>
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
                  const res = await reach(changeGuideSlug(guideId, slug));
                  if (!res.ok) return setError(res.error);
                  toast.success("URL changed. The old one redirects.");
                  setOpen(false);
                  onChanged(res.data.slug);
                })
              }
              className={primary}
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
 * Cover image: upload or drop an image (stored in guide-media). Older covers (an upload in
 * agency-media or a Cloudflare link) still show and can be replaced.
 */
function CoverField({
  value,
  onChange,
  ensureGuideId,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  ensureGuideId: () => Promise<string | null>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const src = value ? (value.startsWith("https://") ? value : STORAGE + value) : null;

  const upload = (file: File | undefined) => {
    if (!file) return;
    startTransition(async () => {
      const guideId = await ensureGuideId();
      if (!guideId) return void toast.error("Give the guide a title first, so it can be saved.");
      const fd = new FormData();
      fd.set("image", file);
      const res = await reach(uploadGuideImage(guideId, fd));
      if (!res.ok) return void toast.error(res.error);
      onChange(res.data.url);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium">Cover image</span>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(e.dataTransfer.files[0]);
        }}
        aria-label={src ? "Replace cover image" : "Upload cover image"}
        className={cn(
          "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-line text-text-2 transition-colors duration-150 hover:border-text-2 disabled:opacity-60",
          over && "border-accent bg-surface",
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of the upload
          <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-4 text-center">
            <ImagePlus className="size-5 [stroke-width:1.5]" aria-hidden />
            {pending ? "Uploading…" : "Upload or drop an image"}
          </span>
        )}
      </button>
      {value && (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => fileInput.current?.click()}
            className="text-accent hover:underline"
          >
            {pending ? "Uploading…" : "Replace"}
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-text-2 hover:text-text hover:underline"
          >
            Remove
          </button>
        </div>
      )}
      <p className="text-admin-meta">
        1600 × 900 (16:9) works best; it&apos;s the social image too. JPG, PNG, WebP or GIF, up to 5
        MB. Without one, a cover is made from the title.
      </p>
    </div>
  );
}
