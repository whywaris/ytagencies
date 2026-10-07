"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveSettings } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";

const input = "h-9 w-28 rounded-lg border border-line bg-bg px-3 num";

/** §5.10 Founding programme: open/closed, max spots, free months. */
export function FoundingSettingsForm({
  open: initialOpen,
  maxSpots: initialSpots,
  freeMonths: initialMonths,
  used,
}: {
  open: boolean;
  maxSpots: number;
  freeMonths: number;
  used: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [maxSpots, setMaxSpots] = useState(String(initialSpots));
  const [freeMonths, setFreeMonths] = useState(String(initialMonths));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const dirty =
    open !== initialOpen ||
    maxSpots !== String(initialSpots) ||
    freeMonths !== String(initialMonths);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveSettings({ foundingOpen: open, maxSpots, freeMonths });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      toast.success("Settings saved");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={open}
          onChange={(e) => setOpen(e.target.checked)}
          className="mt-1 accent-[var(--accent)]"
        />
        <span className="flex flex-col">
          <span className="font-medium">Open to new agencies</span>
          <span className="text-admin-meta">
            When closed, Change plan can&apos;t grant Founding to new agencies and the pricing page
            stops offering it. Current Founding agencies keep their plan.
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="founding-spots" className="font-medium">
          Max spots
        </label>
        <input
          id="founding-spots"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          value={maxSpots}
          onChange={(e) => setMaxSpots(e.target.value)}
          aria-invalid={!!errors.maxSpots}
          aria-describedby="founding-spots-help"
          className={input}
        />
        <span
          id="founding-spots-help"
          className={cn("text-admin-meta num", errors.maxSpots && "text-destructive")}
        >
          {errors.maxSpots ?? `${used} used. An agency keeps its spot after Founding ends.`}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="founding-months" className="font-medium">
          Free months
        </label>
        <input
          id="founding-months"
          type="number"
          inputMode="numeric"
          min={1}
          max={36}
          value={freeMonths}
          onChange={(e) => setFreeMonths(e.target.value)}
          aria-invalid={!!errors.freeMonths}
          aria-describedby="founding-months-help"
          className={input}
        />
        <span
          id="founding-months-help"
          className={cn("text-admin-meta", errors.freeMonths && "text-destructive")}
        >
          {errors.freeMonths ??
            "The default end date when granting Founding. Existing ones don't change."}
        </span>
      </div>

      <button
        type="submit"
        disabled={pending || !dirty}
        className="h-9 self-start rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
