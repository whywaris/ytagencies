"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Copies this page's URL (plus #hash for a section) and says so. Used next to guide headings
 * (icon only) and in the share bar.
 */
export function CopyLinkButton({
  hash,
  label,
  showText = false,
  tipSide = "right",
  className,
}: {
  hash?: string;
  /** Accessible name, e.g. "Copy link to this section". */
  label: string;
  showText?: boolean;
  /** Where "Copied" appears for the icon-only button (left near the right edge of the page). */
  tipSide?: "left" | "right";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${location.origin}${location.pathname}${hash ? `#${hash}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions, insecure context): nothing useful to show.
    }
  };

  const Icon = copied ? Check : Link2;
  return (
    <button type="button" onClick={copy} aria-label={label} className={cn("relative", className)}>
      <Icon className="size-4 [stroke-width:1.75]" aria-hidden />
      {showText && <span>{copied ? "Copied" : "Copy link"}</span>}
      {!showText && copied && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-md bg-text px-2 py-1 text-[13px] font-normal whitespace-nowrap text-bg",
            tipSide === "right" ? "left-full ml-2" : "right-full mr-2",
          )}
        >
          Copied
        </span>
      )}
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </button>
  );
}
