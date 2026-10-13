"use client";

import { useState } from "react";

import { btnLight } from "@/components/dashboard/ui";

/** The embed code with a Copy button (falls back to selecting the text). */
export function BadgeCode({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <div className="mt-3 flex items-center gap-2 overflow-hidden rounded-xl bg-surface px-3 py-2.5 text-[12.5px] text-text-2">
      <code className="min-w-0 flex-1 truncate font-mono">{code}</code>
      <button
        type="button"
        className={`${btnLight} h-[34px] px-3.5 text-[13.5px]`}
        onClick={() =>
          navigator.clipboard?.writeText(code).then(
            () => setState("copied"),
            () => setState("failed"),
          ) ?? setState("failed")
        }
      >
        <span aria-live="polite">
          {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
        </span>
      </button>
    </div>
  );
}
