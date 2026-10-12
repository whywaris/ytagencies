"use client";

import { useState, useTransition } from "react";

import { markLeadContacted } from "@/lib/actions/dashboard";

/** "Mark as contacted" on a routed lead. Feeds the agency's public response time. */
export function MarkContacted({ agencyId, leadId }: { agencyId: string; leadId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await markLeadContacted(agencyId, leadId);
            setError(res.ok ? null : res.error);
          })
        }
        className="flex min-h-11 items-center self-start rounded-full border border-line px-4 font-medium transition-colors duration-150 hover:border-text-2 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark as contacted"}
      </button>
      {error && (
        <p role="alert" className="text-[14px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
