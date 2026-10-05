"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { confirmClaim } from "@/lib/actions/claims";

// A button rather than approving on page load: email link scanners open links and must not approve claims.
export function ConfirmClaimButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
          {error}
        </p>
      )}
      <Button
        className="self-start"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await confirmClaim(token);
            if (res.ok) router.push(`/dashboard/${res.data.agencyId}`);
            else setError(res.error);
          })
        }
      >
        {pending ? "Confirming…" : "Confirm and manage this listing"}
      </Button>
    </div>
  );
}
