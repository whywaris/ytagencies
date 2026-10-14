import { ChevronDown } from "lucide-react";

import type { TocGroup } from "@/lib/guide-content";
import { cn } from "@/lib/utils";

/**
 * Collapsible "On this page" for screens below 1100px (guides and legal pages); the sticky
 * TableOfContents takes over on wider screens. Plain <details>: no JavaScript.
 */
export function TocPanel({
  groups,
  numbered,
  className,
}: {
  groups: TocGroup[];
  numbered: boolean;
  className?: string;
}) {
  return (
    <details
      className={cn(
        "group max-w-reading rounded-2xl border border-line min-[1100px]:hidden print:hidden",
        className,
      )}
    >
      <summary className="flex min-h-12 cursor-pointer items-center justify-between px-5 font-semibold [&::-webkit-details-marker]:hidden">
        On this page
        <ChevronDown
          aria-hidden
          className="size-5 [stroke-width:1.75] text-text-2 transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      <ol className="flex flex-col gap-1 px-5 pb-4 text-[15px]">
        {groups.map((g, i) => (
          <li key={g.id}>
            <a href={`#${g.id}`} className="flex min-h-10 items-center text-text-2 hover:text-text">
              {numbered && <span className="mr-1.5 tabular-nums">{i + 1}.</span>}
              {g.text}
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}
