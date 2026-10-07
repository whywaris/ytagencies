"use client";

import { ArrowUpRight, BadgeCheck, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";

import { ChangePlanDialog } from "@/components/admin/change-plan-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { usePortalContainer } from "@/components/admin/portal";
import { PlanBadge, StatusBadge } from "@/components/admin/ui";
import { AgencyLogo } from "@/components/agency-logo";
import { setAgenciesStatus } from "@/lib/actions/admin-directory";
import { formatCount, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  status: string;
  plan: string;
  is_verified: boolean;
  is_claimed: boolean;
  leads_30d: number;
  updated_at: string;
};

const icon = "size-4 shrink-0 text-text-2 [stroke-width:1.5]";
const menuRow =
  "flex h-8 cursor-default items-center gap-2 rounded-md px-2 outline-none select-none data-[highlighted]:bg-surface-2";

type Pending = { ids: string[]; status: "published" | "draft" | "archived"; names: string };

const VERB = { published: "Publish", draft: "Unpublish", archived: "Archive" } as const;
const DONE = { published: "Published", draft: "Unpublished", archived: "Archived" } as const;

/** Agencies table body with selection, bulk actions and row menus (ADMIN_V2_SPEC §5.2). */
export function AgenciesTable({
  rows,
  header,
  foundingMonths,
}: {
  rows: AgencyRow[];
  header: React.ReactNode;
  foundingMonths: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [planFor, setPlanFor] = useState<AgencyRow | null>(null);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ask = (ids: string[], status: Pending["status"]) => {
    const names =
      ids.length === 1 ? rows.find((r) => r.id === ids[0])!.name : `${ids.length} agencies`;
    setConfirm({ ids, status, names });
  };

  return (
    <>
      {selected.size > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-4 py-2"
        >
          <span className="mr-2">
            <span className="num">{formatCount(selected.size)}</span> selected
          </span>
          {(["published", "draft", "archived"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask([...selected], s)}
              className="h-8 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2"
            >
              {VERB[s]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto h-8 px-2 text-text-2 hover:text-text"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line lg:overflow-visible">
        <table className="w-full border-collapse text-left [&_td]:h-11 [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_td]:align-middle [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:h-9 [&_th]:bg-bg [&_th]:px-3 [&_th]:text-[12px] [&_th]:leading-4 [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-text-2 [&_th]:shadow-[inset_0_-1px_0_var(--line)] lg:[&_th]:top-14 [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl">
          <thead>
            <tr>
              <th scope="col" className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
                  }
                  className="size-4 accent-[var(--accent)]"
                />
              </th>
              {header}
              <th scope="col" className="w-10">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr
                key={a.id}
                className={cn(
                  "transition-colors duration-150 hover:bg-surface-2",
                  selected.has(a.id) && "bg-surface-2",
                )}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${a.name}`}
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                    className="size-4 accent-[var(--accent)]"
                  />
                </td>
                <td className="min-w-56">
                  <div className="flex items-center gap-3">
                    <AgencyLogo name={a.name} logoPath={a.logo_path} size="xs" />
                    <div className="min-w-0">
                      <Link
                        href={`/admin/agencies/${a.id}`}
                        className="font-medium hover:underline"
                      >
                        {a.name}
                      </Link>
                      <div className="truncate text-admin-meta">/{a.slug}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td>
                  <PlanBadge plan={a.plan} />
                </td>
                <td>
                  {a.is_verified ? (
                    <span className="inline-flex items-center gap-1 text-success">
                      <BadgeCheck className="size-4 [stroke-width:1.5]" aria-hidden />
                      Verified
                    </span>
                  ) : (
                    <span className="text-text-2">No</span>
                  )}
                </td>
                <td className={a.is_claimed ? "" : "text-text-2"}>{a.is_claimed ? "Yes" : "No"}</td>
                <td className={cn("text-right num", a.leads_30d === 0 && "text-text-2")}>
                  {formatCount(a.leads_30d)}
                </td>
                <td className="whitespace-nowrap text-text-2 num">{formatDate(a.updated_at)}</td>
                <td>
                  <RowMenu
                    agency={a}
                    onStatus={(s) => ask([a.id], s)}
                    onPlan={() => setPlanFor(a)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={`${VERB[confirm.status]} ${confirm.names}?`}
          description={
            confirm.status === "published"
              ? "They'll appear in the directory and search straight away."
              : confirm.status === "draft"
                ? "They'll disappear from the directory until you publish them again."
                : "Archived agencies are hidden everywhere. You can publish them again later."
          }
          confirmLabel={VERB[confirm.status]}
          tone={confirm.status === "published" ? "default" : "danger"}
          onConfirm={async () => {
            const res = await setAgenciesStatus(confirm.ids, confirm.status);
            if (!res.ok) return res.error;
            toast.success(
              `${DONE[confirm.status]} ${res.data.count === 1 ? confirm.names : `${res.data.count} agencies`}`,
            );
            setSelected(new Set());
            router.refresh();
            return null;
          }}
        />
      )}
      {planFor && (
        <ChangePlanDialog
          agencyId={planFor.id}
          agencyName={planFor.name}
          currentPlan={planFor.plan}
          foundingMonths={foundingMonths}
          open
          onOpenChange={(o) => !o && setPlanFor(null)}
        />
      )}
    </>
  );
}

function RowMenu({
  agency: a,
  onStatus,
  onPlan,
}: {
  agency: AgencyRow;
  onStatus: (s: Pending["status"]) => void;
  onPlan: () => void;
}) {
  const container = usePortalContainer();
  const live = a.status === "published";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Actions for ${a.name}`}
        className="flex size-8 items-center justify-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"
      >
        <MoreHorizontal className="size-4 [stroke-width:1.5]" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={container}>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 w-52 rounded-xl border border-line bg-bg p-1 text-text shadow-lg outline-none"
        >
          <DropdownMenu.Item asChild className={menuRow}>
            <Link href={`/admin/agencies/${a.id}`}>Edit</Link>
          </DropdownMenu.Item>
          {live && (
            <DropdownMenu.Item asChild className={menuRow}>
              <a href={`/agency/${a.slug}`} target="_blank" rel="noopener">
                View live
                <ArrowUpRight className={cn(icon, "ml-auto")} aria-hidden />
              </a>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            className={menuRow}
            onSelect={() => {
              navigator.clipboard.writeText(`${location.origin}/agency/${a.slug}`).then(
                () => toast.success("Link copied"),
                () => toast.error("Couldn't copy the link"),
              );
            }}
          >
            Copy link
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={menuRow}>
            <Link href={`/admin/verification/${a.id}`}>
              {a.is_verified ? "Verification…" : "Verify…"}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuRow} onSelect={onPlan}>
            Change plan…
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {live ? (
            <DropdownMenu.Item
              className={cn(menuRow, "text-destructive")}
              onSelect={() => onStatus("draft")}
            >
              Unpublish…
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item className={menuRow} onSelect={() => onStatus("published")}>
              Publish…
            </DropdownMenu.Item>
          )}
          {a.status !== "archived" && (
            <DropdownMenu.Item
              className={cn(menuRow, "text-destructive")}
              onSelect={() => onStatus("archived")}
            >
              Archive…
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
