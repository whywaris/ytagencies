"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { textareaClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestVerification } from "@/lib/actions/dashboard";

/**
 * Owner's request for the Verified badge: a work email at the agency's own domain (we email it a
 * one-time link) and the channels they'd like us to check.
 */
export function RequestVerification({
  agencyId,
  domain,
  resend,
}: {
  agencyId: string;
  /** The agency's own website domain; the email must be on it or a subdomain. */
  domain: string;
  /** A link was already sent and not clicked yet. */
  resend: boolean;
}) {
  const router = useRouter();
  const [urls, setUrls] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex max-w-reading flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setEmailError(null);
        startTransition(async () => {
          const res = await requestVerification(agencyId, urls.split("\n"), email);
          if (!res.ok) {
            setEmailError(res.fieldErrors?.workEmail ?? null);
            if (!res.fieldErrors?.workEmail) setError(res.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="work-email" className="text-[14px] font-medium">
          Work email at {domain}
        </label>
        <Input
          id="work-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={`you@${domain}`}
          aria-invalid={!!emailError}
          aria-describedby="work-email-hint"
        />
        <p id="work-email-hint" className={emailError ? "text-destructive" : "text-small"}>
          {emailError ??
            "We email it a link to confirm. Personal or temporary addresses (Gmail, Outlook…) can't be used."}
        </p>
      </div>
      <label htmlFor="channels" className="flex flex-col gap-2">
        <span className="text-[14px] font-medium">
          Your YouTube channels <span className="font-normal text-text-2">(optional)</span>
        </span>
        <span className="text-small">
          One per line: youtube.com/@handle or youtube.com/channel/UC…. Include channels you run for
          clients if you can show you manage them.
        </span>
      </label>
      <textarea
        id="channels"
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        rows={3}
        spellCheck={false}
        className={textareaClasses}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sending…" : resend ? "Send the link again" : "Send confirmation link"}
      </Button>
    </form>
  );
}
