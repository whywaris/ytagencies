"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/admin/agencies", label: "Agencies" },
  { href: "/admin/claims", label: "Claims" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/taxonomy", label: "Taxonomy" },
];

export function AdminNav({ counts }: { counts: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin sections"
      className="flex gap-6 overflow-x-auto overflow-y-hidden border-b border-line"
    >
      {SECTIONS.map((s) => {
        const current = pathname === s.href || pathname.startsWith(`${s.href}/`);
        const count = counts[s.href];
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 transition-colors duration-150",
              current
                ? "border-accent text-text"
                : "border-transparent text-text-2 hover:text-text",
            )}
          >
            {s.label}
            {count ? (
              <span className="rounded-full bg-accent px-2 text-[13px] text-on-accent">
                {count}
                <span className="sr-only"> waiting</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
