"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteLead } from "@/lib/actions/admin";

export function DeleteLeadButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={pending}
        className="min-h-11 self-start text-[14px] text-destructive hover:underline"
        onClick={() => {
          if (!window.confirm(`Delete ${name}'s request permanently? This can't be undone.`))
            return;
          startTransition(async () => {
            const res = await deleteLead(id);
            if (res.ok) router.refresh();
            else setError(res.error);
          });
        }}
      >
        {pending ? "Deleting…" : "Delete"}
        <span className="sr-only"> lead from {name}</span>
      </button>
      {error && <span className="text-[14px] text-destructive">{error}</span>}
    </div>
  );
}
