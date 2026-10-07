"use client";

import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { usePortalContainer } from "@/components/admin/portal";
import { deleteSponsoredSlot, saveSponsoredSlot } from "@/lib/actions/admin-revenue";

type Option = { value: string; label: string };

export type SlotValues = {
  service: string;
  kind: "hub" | "industry" | "location";
  segment: string;
  agencyId: string;
  position: string;
  startsOn: string;
  endsOn: string;
  price: string;
};

const control = "h-9 w-full rounded-lg border border-line bg-bg px-2";

/** Create or edit a sponsored slot (§5.8). */
export function SponsoredSlotDialog({
  slotId,
  initial,
  options,
  trigger,
}: {
  slotId: string | null;
  initial: SlotValues;
  options: { services: Option[]; industries: Option[]; locations: Option[]; agencies: Option[] };
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const container = usePortalContainer();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set =
    (k: keyof SlotValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setV((s) => ({ ...s, [k]: e.target.value, ...(k === "kind" ? { segment: "" } : {}) }));

  const field = (label: string, control: React.ReactNode, hint?: string) => (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{label}</span>
      {control}
      {hint && <span className="text-admin-meta">{hint}</span>}
    </label>
  );
  const segments = v.kind === "industry" ? options.industries : options.locations;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setV(initial);
          setError(null);
        }
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-bg p-6 text-text shadow-lg duration-150 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <Dialog.Title className="text-admin-section">
            {slotId ? "Edit sponsored slot" : "New sponsored slot"}
          </Dialog.Title>
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const res = await saveSponsoredSlot(slotId, v);
                if (!res.ok) return setError(res.error);
                toast.success(slotId ? "Slot updated" : "Slot created");
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {field(
                "Service",
                <select value={v.service} onChange={set("service")} className={control} required>
                  <option value="">Choose</option>
                  {options.services.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                "Page",
                <select value={v.kind} onChange={set("kind")} className={control}>
                  <option value="hub">Service hub</option>
                  <option value="industry">For an industry</option>
                  <option value="location">In a location</option>
                </select>,
              )}
            </div>
            {v.kind !== "hub" &&
              field(
                v.kind === "industry" ? "Industry" : "Location",
                <select value={v.segment} onChange={set("segment")} className={control} required>
                  <option value="">Choose</option>
                  {segments.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>,
              )}
            {field(
              "Agency",
              <select value={v.agencyId} onChange={set("agencyId")} className={control} required>
                <option value="">Choose</option>
                {options.agencies.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>,
              options.agencies.length
                ? "Agencies on a paid plan with the Verified badge."
                : "No agency is eligible yet: it needs a paid plan and the Verified badge.",
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              {field(
                "Position",
                <select value={v.position} onChange={set("position")} className={control}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>,
              )}
              {field(
                "Starts",
                <input
                  type="date"
                  value={v.startsOn}
                  onChange={set("startsOn")}
                  className={`${control} num`}
                  required
                />,
              )}
              {field(
                "Ends",
                <input
                  type="date"
                  value={v.endsOn}
                  onChange={set("endsOn")}
                  className={`${control} num`}
                  required
                />,
              )}
            </div>
            {field(
              "Price (US$ a month)",
              <input
                inputMode="decimal"
                value={v.price}
                onChange={set("price")}
                className={`${control} px-3 num`}
                placeholder="For records only"
              />,
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="flex items-center gap-2">
              {slotId && (
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      className="h-9 rounded-lg px-3 font-medium text-text-2 hover:bg-surface-2 hover:text-destructive"
                    >
                      Delete slot…
                    </button>
                  }
                  title="Delete this sponsored slot?"
                  description="The agency stops appearing as Sponsored on this page straight away."
                  confirmLabel="Delete slot"
                  onConfirm={async () => {
                    const res = await deleteSponsoredSlot(slotId);
                    if (!res.ok) return res.error;
                    toast.success("Slot deleted");
                    setOpen(false);
                    router.refresh();
                    return null;
                  }}
                />
              )}
              <Dialog.Close className="ml-auto h-9 rounded-lg border border-line px-3 font-medium hover:bg-surface-2">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving…" : slotId ? "Save slot" : "Create slot"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
