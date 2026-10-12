import Link from "next/link";

import { cn } from "@/lib/utils";

// Admin building blocks (ADMIN_V2_SPEC §3): hairlines, no shadows, 44px rows, sticky header.
// Narrow screens: wide tables scroll sideways in their frame. Desktop: the frame doesn't clip, so
// the header sticks under the 56px top bar while the page scrolls.

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line lg:overflow-visible">
      <table className="w-full border-collapse text-left [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 [&_tbody_tr:hover]:bg-surface-2 [&_td]:h-11 [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-middle [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:h-9 [&_th]:bg-bg [&_th]:px-4 [&_th]:text-[12px] [&_th]:leading-4 [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-text-2 [&_th]:shadow-[inset_0_-1px_0_var(--line)] lg:[&_th]:top-14 [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl">
        {children}
      </table>
    </div>
  );
}

export function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md px-1.5 text-[12px] font-medium whitespace-nowrap capitalize",
        on ? "bg-surface-2 text-text" : "border border-line text-text-2",
      )}
    >
      {children}
    </span>
  );
}

/** Designed zero state: what's empty, and what to do next when there's something to do. */
export function Empty({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line px-6 py-10">
      <p className="text-text-2">{children}</p>
      {action && (
        <Link href={action.href} className="font-medium text-accent hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** Placeholder block shaped like the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none", className)}
    />
  );
}

const STATUS: Record<string, { label: string; dot: string }> = {
  published: { label: "Published", dot: "bg-success" },
  draft: { label: "Draft", dot: "bg-text-2" },
  archived: { label: "Archived", dot: "bg-warning" },
};

/** Agency status: a colored dot (status colors only mean status, §1) and a plain label. */
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, dot: "bg-text-2" };
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  founding: "Founding",
  pro: "Pro",
  // The paid plan's id before it was renamed (still in older audit log entries).
  verified: "Pro",
};

export function PlanBadge({ plan }: { plan: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md px-1.5 text-[12px] font-medium whitespace-nowrap",
        plan === "free" ? "border border-line text-text-2" : "bg-surface-2 text-text",
      )}
    >
      {PLAN_LABEL[plan] ?? plan}
    </span>
  );
}

/** Label/value rows for detail panels. Empty values are skipped. */
export function DetailList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-2">
      {rows
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-text-2">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
    </dl>
  );
}
