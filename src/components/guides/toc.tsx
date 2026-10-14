"use client";

import { useEffect, useState } from "react";

import type { TocGroup } from "@/lib/guide-content";
import { cn } from "@/lib/utils";

/** px from the top of the window: the 52px nav plus some room, matching the headings' scroll-mt. */
const LINE = 96;

/**
 * Desktop "On this page": sticky, highlights the section being read. Server-rendered with the
 * first section active, so nothing shifts when it hydrates. h3s show under the active section.
 */
export function TableOfContents({ groups, numbered }: { groups: TocGroup[]; numbered: boolean }) {
  const [active, setActive] = useState(groups[0]?.id ?? "");

  useEffect(() => {
    const ids = groups.flatMap((g) => [g.id, ...g.children.map((c) => c.id)]);
    const headings = ids.flatMap((id) => document.getElementById(id) ?? []);
    // The current section is the last heading above the line just under the nav. The observer
    // fires whenever a heading crosses that line, including big jumps (links, End key), and on
    // load (e.g. opened at #section).
    const update = () => {
      let current = headings[0]?.id ?? "";
      for (const h of headings) {
        if (h.getBoundingClientRect().top > LINE) break;
        current = h.id;
      }
      setActive(current);
    };
    const observer = new IntersectionObserver(update, { rootMargin: `-${LINE}px 0px 0px 0px` });
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [groups]);

  const activeGroup =
    groups.find((g) => g.id === active || g.children.some((c) => c.id === active))?.id ?? "";

  return (
    <nav aria-labelledby="toc-title" className="flex flex-col gap-3">
      <p id="toc-title" className="text-[14px] font-semibold">
        On this page
      </p>
      <ol className="flex flex-col border-l border-line text-[14px] leading-snug">
        {groups.map((g, i) => (
          <li key={g.id}>
            <a
              href={`#${g.id}`}
              aria-current={g.id === activeGroup ? "true" : undefined}
              className="-ml-px flex border-l-2 border-transparent py-1.5 pl-3 text-text-2 transition-colors duration-150 hover:text-text aria-[current=true]:border-accent aria-[current=true]:font-medium aria-[current=true]:text-text"
            >
              {numbered && <span className="mr-1.5 tabular-nums">{i + 1}.</span>}
              {g.text}
            </a>
            {g.id === activeGroup && g.children.length > 0 && (
              <ol className="mb-1 flex flex-col">
                {g.children.map((c) => (
                  <li key={c.id}>
                    <a
                      href={`#${c.id}`}
                      className={cn(
                        "flex py-1 pl-6 text-[13px] transition-colors duration-150 hover:text-text",
                        c.id === active ? "text-text" : "text-text-2",
                      )}
                    >
                      {c.text}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
