"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { BROWSE_FORM } from "@/lib/browse";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

// /agencies without full reloads. The page is a plain GET form (id="browse") that works without
// JavaScript; this upgrades it: any change rewrites the URL with router.replace (the server
// renders the results), and typing in the search box waits 300ms first.


function queryOf(form: HTMLFormElement, submitter?: HTMLElement | null) {
  const data = new FormData(form, submitter ?? undefined);
  const out = new URLSearchParams();
  // Services and pricing models are checkboxes: one comma-separated param each.
  const multi = new Map<string, string[]>();
  for (const [key, raw] of data) {
    const value = String(raw).trim();
    if (!value) continue;
    if (key === "service" || key === "pricing") multi.set(key, [...(multi.get(key) ?? []), value]);
    else out.set(key, value); // the last value wins (a budget chip over the hidden current one)
  }
  for (const [key, values] of multi) out.set(key, values.join(","));
  if (out.get("sort") === "recommended") out.delete("sort");
  return out.toString();
}

/**
 * After a navigation that didn't come from the form (a removed chip, Clear all, Back), put the
 * fields back in line with the URL. Uncontrolled fields keep their DOM state otherwise; a field
 * already matching is left alone, so focus never moves.
 */
function syncForm(form: HTMLFormElement, params: URLSearchParams) {
  const listed = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      const on =
        el.name === "verified"
          ? params.get("verified") === "1"
          : listed(el.name).includes(el.value);
      if (el.checked !== on) el.checked = on;
    } else if (el instanceof HTMLSelectElement) {
      const v = params.get(el.name) ?? (el.name === "sort" ? "recommended" : "");
      if (el.value !== v) el.value = v;
    } else if (el instanceof HTMLInputElement && el.type === "search") {
      const v = params.get("q") ?? "";
      if (el.value.trim() !== v && document.activeElement !== el) el.value = v;
    }
  }
}

export function BrowseSync({ filterKeys, total }: { filterKeys: string; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const form = document.getElementById(BROWSE_FORM);
    if (!(form instanceof HTMLFormElement)) return;
    const go = (submitter?: HTMLElement | null) => {
      const q = queryOf(form, submitter);
      startTransition(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
    };
    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (el.form !== form) return;
      clearTimeout(timer.current);
      if (el.type === "search") timer.current = setTimeout(() => go(), 300);
      else if (e.type === "change") go();
    };
    const onSubmit = (e: SubmitEvent) => {
      if (e.target !== form) return;
      e.preventDefault();
      clearTimeout(timer.current);
      go(e.submitter);
    };
    document.addEventListener("input", onInput);
    document.addEventListener("change", onInput);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("input", onInput);
      document.removeEventListener("change", onInput);
      document.removeEventListener("submit", onSubmit);
      clearTimeout(timer.current);
    };
  }, [pathname, router]);

  useEffect(() => {
    const form = document.getElementById(BROWSE_FORM);
    if (form instanceof HTMLFormElement) syncForm(form, new URLSearchParams(search));
  }, [search]);

  // GA: filter keys and the result count only (consent and signed-in rules in lib/track.ts).
  useEffect(() => {
    if (filterKeys) track("agency_search", { filters: filterKeys, results: total });
  }, [filterKeys, total]);

  return null;
}

/**
 * The filters: a sidebar from 1024px, a bottom sheet below it ("Filters (n)" opens it, "Show n
 * agencies" closes it). The same markup either way, so there's one set of fields.
 */
export function FilterSheet({
  count,
  total,
  children,
}: {
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="browse-filters"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 self-start rounded-full border border-line bg-raised px-5 font-medium hover:border-text-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filters{count > 0 && ` (${count})`}
      </button>
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-[rgba(16,18,24,.45)] lg:hidden"
        />
      )}
      <div
        id="browse-filters"
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label={open ? "Filters" : undefined}
        className={cn(
          "lg:block",
          open
            ? "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[24px] bg-bg shadow-[0_-16px_40px_-12px_rgba(0,0,0,.35)] lg:static lg:max-h-none lg:rounded-none lg:bg-transparent lg:shadow-none"
            : "hidden",
        )}
      >
        {open && (
          <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
            <p className="font-semibold">Filters</p>
            <button
              ref={close}
              type="button"
              aria-label="Close filters"
              onClick={() => setOpen(false)}
              className="grid size-11 place-items-center rounded-full hover:bg-surface"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        )}
        <div className={cn(open && "overflow-y-auto px-4 py-4 lg:overflow-visible lg:p-0")}>
          {children}
        </div>
        {open && (
          <div className="border-t border-line p-4 lg:hidden">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent font-semibold text-on-accent hover:bg-(--accent-hover)"
            >
              Show {total} {total === 1 ? "agency" : "agencies"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
