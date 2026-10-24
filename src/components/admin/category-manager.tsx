"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteCategory,
  moveCategory,
  saveCategory,
  type CategoryInput,
} from "@/lib/actions/admin-guide-categories";
import { CATEGORY_COLORS, categorySlug, COLOR_KEYS } from "@/lib/guide-categories";
import { cn } from "@/lib/utils";

// Admin → Guides → Categories: order (up/down), add, edit and delete (only when no guide uses it).

export type ManagedCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  show_in_tabs: boolean;
  guides: number;
  live: number;
};

const input = "h-9 w-full rounded-lg border border-line bg-bg px-3";
const button =
  "h-9 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50";

const EMPTY: CategoryInput = {
  name: "",
  slug: "",
  description: "",
  color: "blue",
  showInTabs: true,
};

export function CategoryManager({ categories }: { categories: ManagedCategory[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    startTransition(async () => {
      const res = await fn();
      setMessage(
        res.ok
          ? done
            ? { ok: true, text: done }
            : null
          : { ok: false, text: res.error ?? "Something went wrong." },
      );
      if (res.ok) {
        setEditing(null);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={message.ok ? "text-text-2" : "text-destructive"}
        >
          {message.text}
        </p>
      )}
      <ul className="divide-y divide-line rounded-xl border border-line">
        {categories.map((c, i) => (
          <li key={c.id} className="flex flex-col gap-3 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span
                aria-hidden
                className="size-4 shrink-0 rounded"
                style={{
                  background: CATEGORY_COLORS[c.color as keyof typeof CATEGORY_COLORS]?.hex,
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{c.name}</span>
                <span className="block text-admin-meta">
                  /guides/category/{c.slug} · {c.guides} {c.guides === 1 ? "guide" : "guides"} (
                  {c.live} live)
                  {c.show_in_tabs ? " · tab" : ""}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  className={button}
                  disabled={pending || i === 0}
                  onClick={() => run(() => moveCategory(c.id, "up"))}
                  aria-label={`Move ${c.name} up`}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={pending || i === categories.length - 1}
                  onClick={() => run(() => moveCategory(c.id, "down"))}
                  aria-label={`Move ${c.name} down`}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className={button}
                  onClick={() => setEditing(editing === c.id ? null : c.id)}
                >
                  Edit<span className="sr-only"> {c.name}</span>
                </button>
                <button
                  type="button"
                  className={cn(button, "text-destructive")}
                  disabled={pending}
                  onClick={() => {
                    if (c.guides > 0)
                      return setMessage({
                        ok: false,
                        text: `${c.guides} ${c.guides === 1 ? "guide uses" : "guides use"} “${c.name}”. Move ${c.guides === 1 ? "it" : "them"} to another category first.`,
                      });
                    if (confirm(`Delete “${c.name}”?`))
                      run(() => deleteCategory(c.id), "Category deleted.");
                  }}
                >
                  Delete<span className="sr-only"> {c.name}</span>
                </button>
              </span>
            </div>
            {editing === c.id && (
              <CategoryForm
                initial={{
                  name: c.name,
                  slug: c.slug,
                  description: c.description ?? "",
                  color: c.color,
                  showInTabs: c.show_in_tabs,
                }}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSave={(v) => run(() => saveCategory(c.id, v), "Saved.")}
                slugNote="Changing the slug keeps the old address working (a permanent redirect)."
              />
            )}
          </li>
        ))}
        {categories.length === 0 && <li className="p-3 text-text-2">No categories yet.</li>}
      </ul>
      {editing === "new" ? (
        <div className="rounded-xl border border-line p-3">
          <CategoryForm
            initial={EMPTY}
            pending={pending}
            onCancel={() => setEditing(null)}
            onSave={(v) => run(() => saveCategory(null, v), "Category added.")}
          />
        </div>
      ) : (
        <button
          type="button"
          className={cn(button, "self-start")}
          onClick={() => setEditing("new")}
        >
          Add a category
        </button>
      )}
    </div>
  );
}

function CategoryForm({
  initial,
  pending,
  onSave,
  onCancel,
  slugNote,
}: {
  initial: CategoryInput;
  pending: boolean;
  onSave: (v: CategoryInput) => void;
  onCancel: () => void;
  slugNote?: string;
}) {
  const [v, setV] = useState(initial);
  // The slug follows the name until it's edited by hand.
  const [slugTouched, setSlugTouched] = useState(!!initial.slug);
  const set = <K extends keyof CategoryInput>(k: K, value: CategoryInput[K]) =>
    setV((x) => ({ ...x, [k]: value }));
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Name</span>
        <input
          className={input}
          required
          maxLength={60}
          value={v.name}
          onChange={(e) => {
            set("name", e.target.value);
            if (!slugTouched) set("slug", categorySlug(e.target.value));
          }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Slug</span>
        <input
          className={input}
          maxLength={60}
          value={v.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set("slug", e.target.value);
          }}
        />
        {slugNote && <span className="text-admin-meta">{slugNote}</span>}
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="font-medium">
          Description{" "}
          <span className="font-normal text-text-2">(under the H1 on the category page)</span>
        </span>
        <textarea
          className="min-h-20 w-full rounded-lg border border-line bg-bg px-3 py-2"
          maxLength={300}
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
        <legend className="mb-1.5 font-medium">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {COLOR_KEYS.map((k) => (
            <label
              key={k}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 has-[:checked]:border-accent"
            >
              <input
                type="radio"
                name="color"
                value={k}
                checked={v.color === k}
                onChange={() => set("color", k)}
                className="sr-only"
              />
              <span
                aria-hidden
                className="size-4 rounded"
                style={{ background: CATEGORY_COLORS[k].hex }}
              />
              {CATEGORY_COLORS[k].label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          checked={v.showInTabs}
          onChange={(e) => set("showInTabs", e.target.checked)}
          className="size-4 accent-(--accent)"
        />
        Show as a tab on /guides
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-accent px-3 font-medium text-on-accent disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className={button}>
          Cancel
        </button>
      </div>
    </form>
  );
}
