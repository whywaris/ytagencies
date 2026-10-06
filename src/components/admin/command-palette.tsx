"use client";

import { Command } from "cmdk";
import { Building2, CornerDownLeft, Plus, Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";

import { usePortalContainer } from "@/components/admin/portal";
import { adminSearch, type AdminSearchResults } from "@/lib/actions/admin";

// ⌘K / Ctrl K: jump to a page, find an agency (name, website, slug) or a lead (email), or run a
// quick action. Pages and actions filter locally; agencies and leads come from the server.

const PAGES = [
  { href: "/admin/agencies", label: "Agencies" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/claims", label: "Claims" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/taxonomy", label: "Taxonomy" },
];
const ACTIONS = [{ href: "/admin/agencies/new", label: "New agency" }];
const NONE: AdminSearchResults = { agencies: [], leads: [] };
type Results = AdminSearchResults & { for: string };

const row =
  "flex h-9 cursor-default items-center gap-2.5 rounded-md px-2 select-none data-[selected=true]:bg-surface-2";
const groupHeading =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-admin-meta";
const icon = "size-4 shrink-0 text-text-2 [stroke-width:1.5]";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const container = usePortalContainer();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>({ ...NONE, for: "" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    const q = query.trim();
    let live = true;
    const t = setTimeout(
      () => {
        (q.length < 2 ? Promise.resolve(NONE) : adminSearch(q)).then(
          (r) => live && setResults({ ...r, for: q }),
        );
      },
      q.length < 2 ? 0 : 200,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };
  const q = query.trim().toLowerCase();
  const pages = PAGES.filter((p) => p.label.toLowerCase().includes(q));
  const actions = ACTIONS.filter((a) => a.label.toLowerCase().includes(q));
  // Results belong to the query they were fetched for, so stale ones never show as "nothing".
  const searching = q.length >= 2 && results.for.toLowerCase() !== q;
  const nothing =
    !searching &&
    !pages.length &&
    !actions.length &&
    !results.agencies.length &&
    !results.leads.length;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-bg text-text shadow-lg duration-150 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <Dialog.Title className="sr-only">Search admin</Dialog.Title>
          <Command shouldFilter={false} loop label="Search admin">
            <div className="flex h-12 items-center gap-2.5 border-b border-line px-4">
              <Search className={icon} aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search pages, agencies, lead emails"
                className="h-full flex-1 bg-transparent outline-none placeholder:text-text-2"
              />
            </div>
            <Command.List className="max-h-[min(400px,60vh)] overflow-y-auto p-1">
              {searching && !pages.length && !actions.length && (
                <p className="px-3 py-8 text-center text-text-2">Searching…</p>
              )}
              {nothing && (
                <p className="px-3 py-8 text-center text-text-2">
                  Nothing matches &ldquo;{query.trim()}&rdquo;.
                </p>
              )}
              {pages.length > 0 && (
                <Command.Group heading="Pages" className={groupHeading}>
                  {pages.map((p) => (
                    <Command.Item
                      key={p.href}
                      value={p.href}
                      onSelect={() => go(p.href)}
                      className={row}
                    >
                      <CornerDownLeft className={icon} aria-hidden />
                      {p.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results.agencies.length > 0 && (
                <Command.Group heading="Agencies" className={groupHeading}>
                  {results.agencies.map((a) => (
                    <Command.Item
                      key={a.id}
                      value={`agency-${a.id}`}
                      onSelect={() => go(`/admin/agencies/${a.id}`)}
                      className={row}
                    >
                      <Building2 className={icon} aria-hidden />
                      <span className="truncate">{a.name}</span>
                      <span className="ml-auto truncate text-admin-meta">
                        {a.website?.replace(/^https?:\/\/(www\.)?/, "") ?? `/${a.slug}`}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results.leads.length > 0 && (
                <Command.Group heading="Leads" className={groupHeading}>
                  {results.leads.map((l) => (
                    <Command.Item
                      key={l.id}
                      value={`lead-${l.id}`}
                      onSelect={() => go(`/admin/leads#lead-${l.id}`)}
                      className={row}
                    >
                      <User className={icon} aria-hidden />
                      <span className="truncate">{l.email}</span>
                      <span className="ml-auto truncate text-admin-meta">{l.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {actions.length > 0 && (
                <Command.Group heading="Actions" className={groupHeading}>
                  {actions.map((a) => (
                    <Command.Item
                      key={a.href}
                      value={a.href}
                      onSelect={() => go(a.href)}
                      className={row}
                    >
                      <Plus className={icon} aria-hidden />
                      {a.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
