"use client";

import {
  BarChart3,
  Clapperboard,
  FileText,
  Film,
  LayoutGrid,
  Lock,
  MessageSquare,
  ShieldCheck,
  Star,
  Tag,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// The dashboard's section list (docs/mockups/agency-dashboard.html): a slim sidebar on desktop,
// a scrolling row on small screens. Sections that need Pro (Channels, Analytics) carry a lock.

export function DashboardTabs({
  slug,
  managed,
  waiting,
}: {
  slug: string;
  managed: boolean;
  /** Inquiries not marked as contacted yet. */
  waiting: number;
}) {
  const pathname = usePathname();
  const base = `/dashboard/${slug}`;
  const groups = [
    [
      { href: base, label: "Overview", icon: LayoutGrid },
      {
        href: `${base}/inquiries`,
        label: "Inquiries",
        icon: MessageSquare,
        count: waiting,
      },
      { href: `${base}/profile`, label: "Profile", icon: UserRound },
      { href: `${base}/channels`, label: "Channels", icon: Clapperboard, pro: true },
      { href: `${base}/work-samples`, label: "Work samples", icon: Film },
      { href: `${base}/case-studies`, label: "Case studies", icon: FileText },
      { href: `${base}/verification`, label: "Verification", icon: ShieldCheck },
    ],
    [
      { href: `${base}/analytics`, label: "Analytics", icon: BarChart3, pro: true },
      { href: `${base}/billing`, label: "Plan", icon: Star },
      { href: `${base}/badge`, label: "Badge", icon: Tag },
    ],
  ];
  return (
    <nav
      aria-label="Dashboard"
      className="-mx-4 flex [scrollbar-width:none] gap-1 overflow-x-auto px-4 pb-1 min-[900px]:sticky min-[900px]:top-[76px] min-[900px]:mx-0 min-[900px]:flex-col min-[900px]:gap-0.5 min-[900px]:overflow-visible min-[900px]:px-0"
    >
      {groups.map((group, g) => (
        <div
          key={g}
          className={cn(
            "contents min-[900px]:flex min-[900px]:flex-col min-[900px]:gap-0.5",
            g > 0 &&
              "min-[900px]:mt-2.5 min-[900px]:border-t min-[900px]:border-line-2 min-[900px]:pt-2.5",
          )}
        >
          {group.map(({ href, label, icon: Icon, pro, count }) => {
            // The overview is also /dashboard itself for owners of one agency.
            const current = pathname === href || (href === base && pathname === "/dashboard");
            const locked = pro && !managed;
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-10 shrink-0 items-center gap-2.5 rounded-[10px] px-3 text-[14.5px] whitespace-nowrap transition-colors duration-150",
                  current
                    ? "bg-surface font-semibold text-text"
                    : "text-text-2 hover:bg-surface hover:text-text",
                )}
              >
                <Icon className="size-[17px]" aria-hidden />
                {label}
                {locked ? (
                  <Lock className="ml-auto size-3.5" aria-label="Needs Pro" />
                ) : count ? (
                  <span className="ml-auto rounded-full bg-accent px-[7px] py-px text-[12px] font-[650] text-on-accent tabular-nums">
                    {count}
                    <span className="sr-only"> waiting</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
