"use client";

import { useState, useTransition } from "react";

import { saveGuideTabsMax } from "@/lib/actions/admin-guide-categories";

/** Admin → Settings: how many category tabs /guides shows before "More". */
export function GuideTabsSetting({ value }: { value: number }) {
  const [n, setN] = useState(String(value));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveGuideTabsMax(n);
          setStatus(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
        });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Category tabs on /guides</span>
        <input
          type="number"
          min={1}
          max={12}
          required
          value={n}
          onChange={(e) => setN(e.target.value)}
          className="h-9 w-24 rounded-lg border border-line bg-bg px-3 num"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-lg border border-line px-3 font-medium hover:bg-surface-2 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {status && (
        <p
          role={status.ok ? "status" : "alert"}
          className={status.ok ? "text-text-2" : "text-destructive"}
        >
          {status.text}
        </p>
      )}
    </form>
  );
}
