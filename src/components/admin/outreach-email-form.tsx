"use client";

import { useState, useTransition } from "react";

import { saveOutreachEmail } from "@/lib/actions/admin-directory";

// Admin → Agency → Details: where "You have a project request" goes while the listing is unclaimed.
export function OutreachEmailForm({
  agencyId,
  email,
  optedOut,
}: {
  agencyId: string;
  email: string;
  optedOut: boolean;
}) {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get("email") ?? "");
        startTransition(async () => {
          const res = await saveOutreachEmail(agencyId, value);
          setStatus(
            res.ok
              ? { ok: true, text: "Saved." }
              : { ok: false, text: res.fieldErrors?.email ?? res.error },
          );
        });
      }}
    >
      <label htmlFor="outreach-email" className="font-medium">
        Email for project requests (unclaimed)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="outreach-email"
          name="email"
          type="email"
          defaultValue={email}
          maxLength={254}
          aria-describedby="outreach-email-hint"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg border border-line px-3 font-medium hover:bg-surface-2 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p id="outreach-email-hint" className="text-admin-meta">
        While nobody has claimed the listing, each request from its profile sends one email here
        (at most 3 a week) asking them to claim it. Empty: none is sent.
        {optedOut && " This address unsubscribed, so nothing is sent until it changes."}
      </p>
      {status && (
        <p role={status.ok ? "status" : "alert"} className={status.ok ? "text-text-2" : "text-destructive"}>
          {status.text}
        </p>
      )}
    </form>
  );
}
