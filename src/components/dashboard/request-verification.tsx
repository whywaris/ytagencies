"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { textareaClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { requestVerification } from "@/lib/actions/dashboard";

/** Owner's request for the Verified badge, with the channels they'd like us to check. */
export function RequestVerification({ agencyId }: { agencyId: string }) {
  const router = useRouter();
  const [urls, setUrls] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex max-w-reading flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await requestVerification(agencyId, urls.split("\n"));
          if (!res.ok) return setError(res.error);
          router.refresh();
        });
      }}
    >
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
        {pending ? "Sending…" : "Request verification"}
      </Button>
    </form>
  );
}
