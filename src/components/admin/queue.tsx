"use client";

import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { usePortalContainer } from "@/components/admin/portal";
import { Empty } from "@/components/admin/ui";
import { decideClaim, decideReview, decideSubmission } from "@/lib/actions/admin-directory";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

// Review queue (ADMIN_V2_SPEC §5.3): list on the left, the selected item on the right (a drawer
// below 1024px). j/k move, a approves, r rejects (with an optional reason emailed to the person).

export type QueueItem = {
  id: string;
  title: string;
  meta: string;
  since: string;
  detail: React.ReactNode;
};

const ACTIONS = { submission: decideSubmission, claim: decideClaim, review: decideReview };

export function Queue({
  kind,
  items: initial,
  approveLabel,
  rejectLabel,
  rejectWarning,
  empty,
}: {
  kind: keyof typeof ACTIONS;
  items: QueueItem[];
  /** e.g. "Publish agency" */
  approveLabel: string;
  /** e.g. "Reject submission" */
  rejectLabel: string;
  /** What rejecting does, shown in the confirmation. */
  rejectWarning: string;
  empty: string;
}) {
  const router = useRouter();
  const container = usePortalContainer();
  const [items, setItems] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rejecting, setRejecting] = useState<QueueItem | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const index = Math.max(
    0,
    items.findIndex((i) => i.id === selectedId),
  );
  const selected = items[index] ?? null;

  // Take the server's list when it changes (after router.refresh()).
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setItems(initial);
    if (!initial.some((i) => i.id === selectedId)) setSelectedId(initial[0]?.id ?? null);
  }

  const done = useCallback(
    (id: string) => {
      const i = items.findIndex((x) => x.id === id);
      const next = items.filter((x) => x.id !== id);
      setItems(next);
      setSelectedId(next[Math.min(i, next.length - 1)]?.id ?? null);
      router.refresh();
    },
    [items, router],
  );

  const approve = useCallback(
    (item: QueueItem) =>
      startTransition(async () => {
        const res = await ACTIONS[kind](item.id, "approve", "");
        if (!res.ok) return void toast.error(res.error);
        toast.success(`${approveLabel}: ${item.title}`);
        done(item.id);
      }),
    [kind, approveLabel, done],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || rejecting || pending) return;
      if (t.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (!items.length) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const next = e.key === "j" ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, 0);
        setSelectedId(items[next].id);
        document.getElementById(`queue-${items[next].id}`)?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "a" && selected) {
        e.preventDefault();
        approve(selected);
      } else if (e.key === "r" && selected) {
        e.preventDefault();
        setReason("");
        setRejecting(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, index, selected, rejecting, pending, approve]);

  if (!items.length) return <Empty>{empty}</Empty>;

  const actions = (item: QueueItem) => (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => approve(item)}
        className="h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
      >
        {approveLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setReason("");
          setRejecting(item);
        }}
        className="h-9 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50"
      >
        {rejectLabel}…
      </button>
      <p className="ml-auto hidden text-admin-meta lg:block" aria-hidden>
        <Kbd>j</Kbd> <Kbd>k</Kbd> to move, <Kbd>a</Kbd> to approve, <Kbd>r</Kbd> to reject
      </p>
    </div>
  );

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <ul
          aria-label="Waiting for review"
          className="flex max-h-[calc(100dvh-14rem)] flex-col divide-y divide-line overflow-y-auto rounded-xl border border-line"
        >
          {items.map((item) => (
            <li key={item.id}>
              <button
                id={`queue-${item.id}`}
                type="button"
                aria-current={item.id === selected?.id ? "true" : undefined}
                onClick={() => {
                  setSelectedId(item.id);
                  if (!matchMedia("(min-width: 1024px)").matches) setDrawerOpen(true);
                }}
                className={cn(
                  "relative flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2",
                  item.id === selected?.id && "bg-surface-2",
                )}
              >
                {item.id === selected?.id && (
                  <span
                    aria-hidden
                    className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent"
                  />
                )}
                <span className="flex items-baseline gap-3">
                  <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                  <time
                    dateTime={item.since}
                    title={formatDateTime(item.since)}
                    className="shrink-0 text-admin-meta num"
                  >
                    {formatRelative(item.since)}
                  </time>
                </span>
                <span className="truncate text-admin-meta">{item.meta}</span>
              </button>
            </li>
          ))}
        </ul>

        {selected && (
          <section
            aria-label={selected.title}
            className="hidden flex-col gap-6 rounded-xl border border-line p-6 lg:flex"
          >
            <h2 className="text-admin-section">{selected.title}</h2>
            <div className="flex flex-col gap-4">{selected.detail}</div>
            {actions(selected)}
          </section>
        )}
      </div>

      <Dialog.Root open={drawerOpen && !!selected} onOpenChange={setDrawerOpen}>
        <Dialog.Portal container={container}>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 lg:hidden" />
          {selected && (
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 right-0 z-50 flex w-[min(480px,100vw)] flex-col gap-6 overflow-y-auto border-l border-line bg-bg p-6 text-text shadow-lg outline-none lg:hidden"
            >
              <Dialog.Title className="text-admin-section">{selected.title}</Dialog.Title>
              <div className="flex flex-col gap-4">{selected.detail}</div>
              {actions(selected)}
              <Dialog.Close className="h-9 self-start rounded-lg px-3 text-text-2 hover:text-text">
                Close
              </Dialog.Close>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>

      {rejecting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRejecting(null)}
          title={`${rejectLabel}: ${rejecting.title}?`}
          description={rejectWarning}
          confirmLabel={rejectLabel}
          onConfirm={async () => {
            const res = await ACTIONS[kind](rejecting.id, "reject", reason);
            if (!res.ok) return res.error;
            toast.success(`${rejectLabel}: ${rejecting.title}`);
            setDrawerOpen(false);
            done(rejecting.id);
            return null;
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-medium">
              Reason <span className="font-normal text-text-2">(optional, emailed to them)</span>
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={3}
              className="rounded-lg border border-line bg-bg px-3 py-2"
            />
          </label>
        </ConfirmDialog>
      )}
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line px-1 font-sans text-[11px] text-text-2">
      {children}
    </kbd>
  );
}
