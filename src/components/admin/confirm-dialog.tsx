"use client";

import { AlertDialog } from "radix-ui";
import { useState, useTransition } from "react";

import { usePortalContainer } from "@/components/admin/portal";
import { cn } from "@/lib/utils";

/**
 * Confirmation for destructive actions (ADMIN_V2_SPEC §5): names the item, traps focus, closes on
 * Esc. `onConfirm` returns an error message to show, or null when done. Pass `trigger`, or
 * control it with `open`/`onOpenChange` (e.g. from a menu item).
 */
export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "danger",
  confirmDisabled = false,
  children,
  onConfirm,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  /** e.g. until the admin has typed the name of what they're deleting. */
  confirmDisabled?: boolean;
  /** Extra fields, e.g. an optional reason. */
  children?: React.ReactNode;
  onConfirm: () => Promise<string | null>;
}) {
  const container = usePortalContainer();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = (o: boolean) => {
    if (controlledOpen === undefined) setOwnOpen(o);
    onOpenChange?.(o);
  };
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      {trigger && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}
      <AlertDialog.Portal container={container}>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-line bg-bg p-6 text-text shadow-lg duration-150 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
          <AlertDialog.Title className="text-admin-section">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-text-2">{description}</AlertDialog.Description>
          {children}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <AlertDialog.Cancel className="h-9 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2">
              Cancel
            </AlertDialog.Cancel>
            <button
              type="button"
              disabled={pending || confirmDisabled}
              onClick={() =>
                startTransition(async () => {
                  const err = await onConfirm();
                  if (err) setError(err);
                  else setOpen(false);
                })
              }
              className={cn(
                "h-9 rounded-lg px-3 font-medium transition-opacity duration-150 hover:opacity-90 disabled:opacity-50",
                tone === "danger" ? "bg-destructive text-bg" : "bg-accent text-on-accent",
              )}
            >
              {pending ? "Working…" : confirmLabel}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
