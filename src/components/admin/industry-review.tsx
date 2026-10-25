"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Empty } from "@/components/admin/ui";
import { approveConfident, reviewSuggestion } from "@/lib/actions/admin-industry-review";
import { cn } from "@/lib/utils";

// The Industry review queue: suggestions grouped by agency. J / K move between rows, A approves,
// R rejects (not while typing in a field). Reviewed rows leave the list at once.

export type ReviewRow = {
  id: string;
  industry: string;
  parts: { text: string; hit: boolean }[];
  sourceUrl: string;
  method: string;
  confidence: number;
};
export type ReviewGroup = { agencyId: string; name: string; slug: string | null; rows: ReviewRow[] };

const btn =
  "h-8 rounded-lg border border-line px-3 text-[13px] font-medium transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent";

export function IndustryReview({ groups }: { groups: ReviewGroup[] }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const visible = groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => !done.has(r.id)) }))
    .filter((g) => g.rows.length);
  const flat = visible.flatMap((g) => g.rows);
  const current = flat[Math.min(active, flat.length - 1)];

  function run(ids: string[], action: () => Promise<{ ok: true; done: number } | { ok: false; error: string }>) {
    start(async () => {
      const res = await action();
      if (!res.ok) return void toast.error(res.error);
      setDone((d) => new Set([...d, ...ids]));
      router.refresh();
    });
  }
  const decide = (row: ReviewRow, decision: "approved" | "rejected") =>
    run([row.id], () => reviewSuggestion(row.id, decision));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || pending) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (key === "j" || key === "k") {
        e.preventDefault();
        setActive((i) => Math.max(0, Math.min(flat.length - 1, i + (key === "j" ? 1 : -1))));
      } else if ((key === "a" || key === "r") && current) {
        e.preventDefault();
        decide(current, key === "a" ? "approved" : "rejected");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (current) rowRefs.current.get(current.id)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  if (!visible.length) return <Empty>Nothing to review. Run pnpm enrich:industries to find more.</Empty>;

  return (
    <div className="flex flex-col gap-6">
      {visible.map((g) => {
        const confident = g.rows.filter((r) => r.confidence >= 0.8);
        return (
          <section key={g.agencyId} aria-label={g.name} className="rounded-xl border border-line">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{g.name}</span>
                {g.slug && (
                  <a href={`/agency/${g.slug}`} target="_blank" rel="noopener noreferrer" className="text-admin-meta hover:underline">
                    Profile
                  </a>
                )}
              </div>
              {confident.length > 0 && (
                <button
                  type="button"
                  className={btn}
                  disabled={pending}
                  onClick={() => run(confident.map((r) => r.id), () => approveConfident(g.agencyId))}
                >
                  Approve all ≥ 0.8 ({confident.length})
                </button>
              )}
            </header>
            <ul>
              {g.rows.map((r) => {
                const isActive = r.id === current?.id;
                return (
                  <li
                    key={r.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(r.id, el);
                      else rowRefs.current.delete(r.id);
                    }}
                    aria-current={isActive || undefined}
                    onClick={() => setActive(flat.indexOf(r))}
                    className={cn(
                      "flex flex-col gap-2 border-t border-line px-4 py-3 first:border-t-0 sm:flex-row sm:items-start sm:justify-between",
                      isActive && "bg-surface-2 shadow-[inset_2px_0_0_var(--accent)]",
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.industry}</span>
                        <span className="num text-admin-meta">
                          {r.confidence.toFixed(2)} · {r.method === "llm" ? "LLM" : "keywords"}
                        </span>
                      </div>
                      <blockquote className="text-[14px] text-text-2">
                        “
                        {r.parts.map((p, i) =>
                          p.hit ? (
                            <mark key={i} className="rounded-sm bg-accent/15 px-0.5 text-text">
                              {p.text}
                            </mark>
                          ) : (
                            <span key={i}>{p.text}</span>
                          ),
                        )}
                        ”
                      </blockquote>
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 self-start text-admin-meta break-all hover:underline"
                      >
                        {r.sourceUrl}
                        <ExternalLink aria-hidden className="size-3 shrink-0" />
                      </a>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" className={btn} disabled={pending} onClick={() => decide(r, "approved")}>
                        Approve
                      </button>
                      <button type="button" className={btn} disabled={pending} onClick={() => decide(r, "rejected")}>
                        Reject
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
