"use client";

import { useState, useTransition } from "react";

import { Honeypot } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { requestRemoval } from "@/lib/actions/removal";

// /remove-listing: the agency is fixed by the signed link; the sender gives an email on its domain
// and, optionally, a reason.

export function RemovalForm({ agencyId, token, agencyName }: { agencyId: string; token: string; agencyName: string }) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done)
    return (
      <p role="status" className="rounded-xl bg-surface p-5">
        Thanks. We&apos;ll review the request for {agencyName} and email you when it&apos;s done, usually within
        2 business days.
      </p>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setFieldError(null);
        start(async () => {
          const res = await requestRemoval({ agencyId, token, email, reason, website });
          if (res.ok) return setDone(true);
          setError(res.error);
          setFieldError(res.fieldErrors?.email ?? null);
        });
      }}
    >
      <label className="flex flex-col gap-1.5 font-medium">
        Your email at the agency
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? "rm-email-error" : undefined}
          className="h-11 rounded-xl border border-line bg-bg px-3 font-normal"
        />
        {fieldError && (
          <span id="rm-email-error" className="text-[14px] font-normal text-destructive">
            {fieldError}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1.5 font-medium">
        Reason (optional)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          rows={4}
          className="rounded-xl border border-line bg-bg p-3 font-normal"
        />
      </label>
      <Honeypot name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sending…" : "Ask to remove the listing"}
      </Button>
    </form>
  );
}
