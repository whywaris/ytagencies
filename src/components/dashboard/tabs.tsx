"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function DashboardTabs({ agencyId }: { agencyId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/dashboard/${agencyId}`, label: "Profile" },
    { href: `/dashboard/${agencyId}/leads`, label: "Leads" },
    { href: `/dashboard/${agencyId}/billing`, label: "Billing" },
    { href: `/dashboard/${agencyId}/plan`, label: "Analytics" },
  ];
  return (
    <nav aria-label="Listing sections" className="flex gap-6 border-b border-line">
      {tabs.map((t) => {
        const current = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-11 items-center border-b-2 transition-colors duration-150",
              current
                ? "border-accent text-text"
                : "border-transparent text-text-2 hover:text-text",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
