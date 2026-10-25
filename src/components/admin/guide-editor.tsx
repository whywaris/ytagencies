"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  ImagePlus,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";
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
  checkCoverLink,
  deleteGuide,
  discardGuideDraft,
  saveGuide,
  setGuideFeatured,
  setGuideStatus,
  uploadGuideImage,
  type GuideInput,
} from "@/lib/actions/admin-guides";
import { formatDateTime } from "@/lib/format";
import { placeholdersIn } from "@/lib/guide-blocks";
import { docText, imagesWithoutAlt, type Doc } from "@/lib/guide-content";
import { isAlternatives, prePublishChecks, type Panel } from "@/lib/guide-template";
import { cn } from "@/lib/utils";

// The guide editor (ADMIN_V2_SPEC §8), full screen like WordPress: a top bar (back, status, Preview,
// Save draft, Publish, sidebar), the canvas (title, URL, the editor on the public stylesheet) and a
// sidebar of collapsible panels that say what's missing when closed. Drafts autosave a few seconds
// after typing stops; Ctrl+S saves now; leaving with unsaved changes asks first. Publishing runs the
// same pre-publish check as the server (lib/guide-template.ts).

export type Combo = { service_id: number; industry_id?: number; location_id?: number };
export type ComboOption = { key: string; label: string; combo: Combo };
export type AuthorOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string; slug: string };

export type EditorGuide = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: Doc;
  coverPath: string | null;
  coverAlt: string;
  /** Alternatives only: yyyy-mm-dd, or "". */
  pricesCheckedOn: string;
  seoTitle: string;
  seoDescription: string;
  authorId: string | null;
  categoryId: string | null;
  /** The featured guide on /guides (at most one; saved straight away, not drafted). */
  isFeatured: boolean;
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
const SEO_TITLE_MAX = 60;
const SEO_DESC_MAX = 160;
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

/** "just now", "2 min ago", "3 h ago". */
function ago(at: number, now: number) {
  const m = Math.floor((now - at) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
}

/** "Featured on /guides": saved straight away; turning it on turns the previous one off. */
function FeaturedToggle({ id, initial }: { id: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <label className="mt-2 flex items-start gap-2">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setError(null);
          startTransition(async () => {
            const res = await setGuideFeatured(id, next);
            if (res.ok) setOn(next);
            else setError(res.error);
          });
        }}
        className="mt-1 size-4 accent-(--accent)"
      />
      <span className="flex flex-col gap-0.5">
        <span>Featured on /guides</span>
        <span className="text-admin-meta">
          {error ?? "One guide at a time; turning this on unfeatures the current one."}
        </span>
      </span>
    </label>
  );
}

export function GuideEditor({
  guide,
  comboOptions,
  authors,
  categories,
  siteHost,
  services,
}: {
  guide: EditorGuide;
  comboOptions: ComboOption[];
  authors: AuthorOption[];
  categories: CategoryOption[];
  siteHost: string;
  /** For the budget range and directory stats blocks. */
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
    coverAlt: guide.coverAlt,
    pricesCheckedOn: guide.pricesCheckedOn,
    seoTitle: guide.seoTitle,
    seoDescription: guide.seoDescription,
    authorId: guide.authorId,
    categoryId: guide.categoryId,
    related: guide.related,
    keyTakeaways: guide.keyTakeaways,
    numberedSections: guide.numberedSections,
  });
  const [saveState, setSaveState] = useState<SaveState>(guide.id ? "saved" : "new");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [hasDraft, setHasDraft] = useState(guide.hasDraft);
  const [sidebar, setSidebar] = useState(true);
  const [open, setOpen] = useState<Set<Panel>>(() => new Set(["status"]));
  const [pending, startTransition] = useTransition();
  const latest = useRef(values);
  const saving = useRef<Promise<string | null> | null>(null);
  // The last save's error, read right after awaiting save() (state would still hold the old one).
  const lastError = useRef<string | null>(null);

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
      // Plain JSON: the editor's node attributes aren't plain objects, and a server action
      // receives anything else as an unreadable client reference.
      const res = await reach(saveGuide(id, JSON.parse(JSON.stringify(snapshot)) as Values));
      if (!res.ok) {
        setSaveState("error");
        setSaveError(res.error);
        lastError.current = res.error;
        return null;
      }
      setSaveError(null);
      lastError.current = null;
      if (!id) {
        setId(res.data.id);
        // Stay mounted: just update the address bar to the guide's own URL.
        window.history.replaceState(null, "", `/admin/guides/${res.data.id}`);
      }
      setSlug(res.data.slug);
      setHasDraft(res.data.draft);
      setSavedAt(Date.now());
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

  // "Saved 2 min ago" stays current.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (saveState === "saved" || saveState === "new") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const saveNow = () =>
    startTransition(async () => {
      const ok = await save();
      if (ok) toast.success(hasDraft || live ? "Changes saved (not published yet)" : "Draft saved");
      else if (lastError.current) toast.error(lastError.current);
    });

  // ───────── Publish ─────────
  const [scheduleAt, setScheduleAt] = useState("");
  const live = status !== "draft" && !!publishedAt && new Date(publishedAt) <= new Date();
  const category = categories.find((c) => c.id === values.categoryId) ?? null;
  const alternatives = isAlternatives(category?.slug);
  const text = docText(values.body);
  const checks = prePublishChecks({
    categoryId: values.categoryId,
    categorySlug: category?.slug ?? null,
    excerpt: values.excerpt,
    coverPath: values.coverPath,
    coverAlt: values.coverAlt,
    seoDescription: values.seoDescription,
    pricesCheckedOn: values.pricesCheckedOn || null,
    hasText: !!text,
    imagesWithoutAlt: imagesWithoutAlt(values.body),
    placeholders: placeholdersIn(text).length,
  });
  const blocking = checks.filter((c) => c.blocking);

  const show = (panel: Panel) => {
    setSidebar(true);
    setOpen((o) => new Set(o).add(panel));
    requestAnimationFrame(() =>
      document.getElementById(`panel-${panel}`)?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  };

  const changeStatus = (
    raw: { action: "publish" | "unpublish" } | { action: "schedule"; at: string },
  ) =>
    startTransition(async () => {
      if (raw.action !== "unpublish" && blocking.length) {
        show("status");
        return void toast.error(`Before publishing: ${blocking.map((c) => c.label.toLowerCase()).join(", ")}.`);
      }
      const guideId = await save();
      if (!guideId) return void toast.error(lastError.current ?? "Save the guide first.");
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
  const stateLabel = status === "draft" ? "Draft" : live ? "Published" : "Scheduled";
  const saveLabel = {
    new: "Not saved yet",
    saved: savedAt ? `Saved ${ago(savedAt, now)}` : "Saved",
    dirty: "Unsaved changes",
    untitled: "Add a title to save",
    saving: "Saving…",
    error: "Couldn't save",
  }[saveState];
  const takeaways = values.keyTakeaways.filter((l) => l.trim()).length;

  const toggle = (panel: Panel) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(panel)) next.delete(panel);
      else next.add(panel);
      return next;
    });
  const panel = (key: Panel, title: string, summary: string, warn: boolean, children: React.ReactNode) => (
    <SidePanel key={key} id={key} title={title} summary={summary} warn={warn} open={open.has(key)} onToggle={() => toggle(key)}>
      {children}
    </SidePanel>
  );

  return (
    // Full screen over the admin layout (its left nav is hidden on this screen).
    <div className="fixed inset-0 z-40 flex flex-col bg-bg text-text">
      {/* ───────── Top bar ───────── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-3">
        <Link
          href="/admin/guides"
          onClick={async (e) => {
            if (saveState !== "dirty") return;
            e.preventDefault();
            await save();
            router.push("/admin/guides");
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2 font-medium hover:bg-surface-2"
        >
          <ArrowLeft className="size-4 [stroke-width:1.5]" aria-hidden />
          Guides
        </Link>
        <p role="status" className="min-w-0 flex-1 truncate text-center text-admin-meta" title={saveState === "error" ? (saveError ?? undefined) : undefined}>
          <span className="font-medium text-text">{stateLabel}</span>
          {" · "}
          <span className={cn(saveState === "error" && "text-destructive")}>{saveLabel}</span>
          {live && changed && <span className="text-warning"> · Unpublished changes</span>}
        </p>
        <div className="flex items-center gap-2">
          {id ? (
            <a href={`/admin/guides/${id}/preview`} target="_blank" rel="noopener" className={cn(secondary, "inline-flex items-center gap-1")}>
              Preview
              <ArrowUpRight className="size-4 [stroke-width:1.5]" aria-hidden />
            </a>
          ) : (
            <button type="button" disabled className={secondary} title="Save the guide first">
              Preview
            </button>
          )}
          <button type="button" onClick={saveNow} disabled={pending || saveState === "saving"} className={secondary}>
            {live ? "Save changes" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => changeStatus({ action: "publish" })}
            disabled={pending || (live && !changed)}
            className={primary}
          >
            {status === "draft" ? "Publish" : live ? "Update" : "Publish now"}
          </button>
          <button
            type="button"
            onClick={() => setSidebar((v) => !v)}
            aria-pressed={sidebar}
            aria-label={sidebar ? "Hide settings" : "Show settings"}
            title={sidebar ? "Hide settings" : "Show settings"}
            className="flex size-9 items-center justify-center rounded-lg hover:bg-surface-2"
          >
            {sidebar ? (
              <PanelRightClose className="size-4 [stroke-width:1.5]" aria-hidden />
            ) : (
              <PanelRightOpen className="size-4 [stroke-width:1.5]" aria-hidden />
            )}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ───────── Canvas ───────── */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[760px] px-6 pt-10">
            <RichEditor
              initial={guide.body}
              services={services}
              ensureGuideId={async () => id ?? (await save())}
              onChange={(doc) => set("body", doc)}
              onSave={saveNow}
              header={
                <div className="mb-6 flex flex-col gap-2">
                  <label className="contents">
                    <span className="sr-only">Title</span>
                    <textarea
                      value={values.title}
                      onChange={(e) => set("title", e.target.value.replace(/\n/g, " "))}
                      placeholder="Add title"
                      maxLength={200}
                      rows={1}
                      className="field-sizing-content w-full resize-none bg-transparent text-display outline-none placeholder:text-text-2"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-1 text-admin-meta">
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
                      <SlugEdit value={values.slug} placeholder={shownSlug} onChange={(v) => set("slug", v)} />
                    )}
                  </div>
                </div>
              }
            />
          </div>
        </main>

        {/* ───────── Sidebar ───────── */}
        {sidebar && (
          <aside aria-label="Guide settings" className="flex w-[340px] shrink-0 flex-col gap-2 overflow-y-auto border-l border-line bg-surface/40 p-3 max-lg:absolute max-lg:inset-y-14 max-lg:right-0 max-lg:z-30 max-lg:bg-bg max-lg:shadow-lg">
            {panel(
              "status",
              "Status",
              `${stateLabel} · ${blocking.length ? `${checks.length} ${checks.length === 1 ? "thing" : "things"} left` : checks.length ? `${checks.length} to review` : "Ready"}`,
              blocking.length > 0,
              <>
                {status === "scheduled" && !live && publishedAt && (
                  <p className="text-admin-meta num">Goes live {formatDateTime(publishedAt)}</p>
                )}
                {live && publishedAt && <p className="text-admin-meta num">Live since {formatDateTime(publishedAt)}</p>}
                {live && hasDraft && id && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className="text-warning">Unpublished changes</span>
                    <ConfirmDialog
                      trigger={
                        <button type="button" disabled={pending} className="text-accent hover:underline">
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
                  </div>
                )}
                {status === "draft" && (
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
                      onClick={() => changeStatus({ action: "schedule", at: new Date(scheduleAt).toISOString() })}
                      className={secondary}
                    >
                      Schedule
                    </button>
                  </div>
                )}
                {id && <FeaturedToggle id={id} initial={guide.isFeatured} />}

                <div className="flex flex-col gap-1.5 border-t border-line pt-3">
                  <p className="font-medium">
                    {checks.length ? `Pre-publish check: ${checks.length} ${checks.length === 1 ? "thing" : "things"} left` : "Pre-publish check: all done"}
                  </p>
                  {checks.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {checks.map((c) => (
                        <li key={c.key}>
                          <button
                            type="button"
                            onClick={() => (c.panel === "content" ? document.querySelector<HTMLElement>(".ProseMirror")?.focus() : show(c.panel))}
                            className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left hover:bg-surface-2"
                          >
                            <CircleAlert className={cn("mt-0.5 size-4 shrink-0 [stroke-width:1.5]", c.blocking ? "text-destructive" : "text-warning")} aria-hidden />
                            <span className="flex-1">{c.label}</span>
                            <span className="text-admin-meta">{c.blocking ? "Required" : "Recommended"}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!checks.length && (
                    <p className="flex items-center gap-2 text-admin-meta">
                      <CircleCheck className="size-4 [stroke-width:1.5] text-success" aria-hidden />
                      Everything a guide needs is there.
                    </p>
                  )}
                </div>

                {(live || status !== "draft") && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {live && (
                      <a href={`/guides/${slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:underline">
                        View live
                        <ArrowUpRight className="size-4 [stroke-width:1.5] text-text-2" aria-hidden />
                      </a>
                    )}
                    <ConfirmDialog
                      trigger={
                        <button type="button" disabled={pending} className="ml-auto text-text-2 hover:text-text hover:underline">
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
                  </div>
                )}
              </>,
            )}

            {panel(
              "category",
              "Category & author",
              [category?.name ?? "Category missing", authors.find((a) => a.id === values.authorId)?.name ?? "No author"].join(" · ") +
                (alternatives && !values.pricesCheckedOn ? " · Prices date missing" : ""),
              !category || (alternatives && !values.pricesCheckedOn),
              <>
                <label className={label}>
                  <span className="font-medium">Category</span>
                  <select value={values.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)} className={input}>
                    <option value="">Choose a category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-admin-meta">
                    Needed to publish.{" "}
                    {/* New tab: leaving here mid-edit would skip the unsaved-changes warning. */}
                    <Link href="/admin/guides/categories" target="_blank" rel="noopener" className="text-accent hover:underline">
                      Manage categories
                    </Link>
                  </span>
                </label>
                {alternatives && (
                  <label className={label}>
                    <span className="font-medium">Prices checked on</span>
                    <input
                      type="date"
                      value={values.pricesCheckedOn}
                      onChange={(e) => set("pricesCheckedOn", e.target.value)}
                      className={cn(input, "num")}
                    />
                    <span className="text-admin-meta">
                      Shown in the disclosure: when you last checked the other platforms&apos; public pricing pages. Needed to publish.
                    </span>
                  </label>
                )}
                <label className={label}>
                  <span className="font-medium">Author</span>
                  <select value={values.authorId ?? ""} onChange={(e) => set("authorId", e.target.value || null)} className={input}>
                    <option value="">No author</option>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-admin-meta">
                    Shown in the byline and the author box.{" "}
                    <Link href="/admin/authors" target="_blank" rel="noopener" className="text-accent hover:underline">
                      Manage authors
                    </Link>
                  </span>
                </label>
              </>,
            )}

            {panel(
              "cover",
              "Cover image",
              !values.coverPath ? "None: made from the title" : values.coverAlt.trim() ? "Set" : "Alt text missing",
              !!values.coverPath && !values.coverAlt.trim(),
              <>
                <CoverField value={values.coverPath} onChange={(v) => set("coverPath", v)} ensureGuideId={async () => id ?? (await save())} />
                {values.coverPath && (
                  <Counted label="Alt text (required)" value={values.coverAlt} max={200} hint="Describe the image for people who can't see it.">
                    <input
                      value={values.coverAlt}
                      onChange={(e) => set("coverAlt", e.target.value)}
                      maxLength={200}
                      aria-invalid={!values.coverAlt.trim()}
                      className={cn(input, !values.coverAlt.trim() && "border-warning")}
                    />
                  </Counted>
                )}
              </>,
            )}

            {panel(
              "excerpt",
              "Excerpt & key takeaways",
              values.excerpt.trim()
                ? `Excerpt ${values.excerpt.length}/300 · ${takeaways} ${takeaways === 1 ? "takeaway" : "takeaways"}`
                : "Excerpt missing",
              !values.excerpt.trim(),
              <>
                <Counted label="Excerpt" value={values.excerpt} max={300} hint="Shown on the guides page and as the subtitle.">
                  <textarea
                    value={values.excerpt}
                    onChange={(e) => set("excerpt", e.target.value)}
                    maxLength={300}
                    rows={3}
                    className="w-full rounded-lg border border-line bg-bg px-3 py-2"
                  />
                </Counted>
                <label className={label}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">Key takeaways</span>
                    <span className={cn("text-admin-meta num", takeaways > 5 && "text-destructive")}>{takeaways} / 5</span>
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
                    <span className="text-admin-meta">For lists and step-by-step guides: numbers each main heading.</span>
                  </span>
                </label>
              </>,
            )}

            {panel(
              "seo",
              "SEO",
              `Title ${seoTitle.length}/${SEO_TITLE_MAX} · Desc ${values.seoDescription.length}/${SEO_DESC_MAX}`,
              !values.seoDescription.trim(),
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
              />,
            )}

            {panel(
              "related",
              "Related directory pages",
              values.related.length ? `${values.related.length} ${values.related.length === 1 ? "page" : "pages"}` : "None yet",
              false,
              <RelatedPicker options={comboOptions} value={values.related} onChange={(related) => set("related", related)} />,
            )}

            {id && (
              <ConfirmDialog
                trigger={
                  <button type="button" className="mt-2 self-start px-1 text-destructive hover:underline">
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
        )}
      </div>
    </div>
  );
}

/** A sidebar panel: closed, its title and a short status ("Excerpt missing"); open, its fields. */
function SidePanel({
  id,
  title,
  summary,
  warn,
  open,
  onToggle,
  children,
}: {
  id: Panel;
  title: string;
  summary: string;
  warn: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={`panel-${id}`} className="scroll-mt-3 rounded-xl border border-line bg-bg">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`panel-${id}-body`}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-4 py-2 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">{title}</span>
            {!open && <span className={cn("truncate text-admin-meta", warn && "text-warning")}>{summary}</span>}
          </span>
          <ChevronDown
            className={cn("size-4 shrink-0 [stroke-width:1.5] text-text-2 transition-transform duration-150", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </h2>
      {open && (
        <div id={`panel-${id}-body`} className="flex flex-col gap-3 px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}

/** The URL line under the title: shown as text with an Edit button, edited inline. */
function SlugEdit({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (!editing)
    return (
      <>
        <span className="text-text">{value || placeholder}</span>
        <button type="button" onClick={() => setEditing(true)} className="ml-1 text-accent hover:underline">
          Edit
        </button>
      </>
    );
  return (
    <input
      autoFocus
      aria-label="URL"
      value={value}
      onChange={(e) => onChange(e.target.value.toLowerCase())}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
      placeholder={placeholder}
      className="h-8 min-w-48 flex-1 rounded-md border border-line bg-bg px-2 text-text"
    />
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
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
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

  // Or a link to an image on the media host (R2), checked on the server before it's used.
  const applyLink = () =>
    startTransition(async () => {
      if (!link.trim()) return;
      const res = await reach(checkCoverLink(link));
      if (!res.ok) return setLinkError(res.error);
      setLinkError(null);
      setLink("");
      onChange(res.data.url);
    });

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
      <div className="mt-2 flex flex-col gap-1.5">
        <label htmlFor="cover-link" className="text-admin-meta">
          Or use a link from the media host
        </label>
        <div className="flex gap-2">
          <input
            id="cover-link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
            placeholder="https://media.ytagencies.com/covers/…"
            aria-invalid={!!linkError}
            aria-describedby={linkError ? "cover-link-error" : undefined}
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3"
          />
          <button
            type="button"
            disabled={pending || !link.trim()}
            onClick={applyLink}
            className="h-9 rounded-lg border border-line px-3 font-medium hover:bg-surface-2 disabled:opacity-50"
          >
            Use link
          </button>
        </div>
        {linkError && (
          <p id="cover-link-error" role="alert" className="text-admin-meta text-destructive">
            {linkError}
          </p>
        )}
      </div>
      <p className="text-admin-meta">
        1600 × 900 (16:9) works best; it&apos;s the social image too. Uploads: JPG, PNG, WebP or
        GIF, up to 5 MB. Links: PNG, WebP or JPG, up to 1 MB. Without one, a cover is made from the
        title.
      </p>
    </div>
  );
}
