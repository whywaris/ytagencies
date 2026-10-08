"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ChangePlanDialog } from "@/components/admin/change-plan-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DeleteAgenciesDialog } from "@/components/admin/delete-agencies-dialog";
import { setAgenciesStatus } from "@/lib/actions/admin-directory";

const button =
  "flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2";

/** Agency detail header: view live, publish/unpublish (confirmed), change plan. */
export function AgencyHeaderActions({
  agency,
  foundingMonths,
}: {
  agency: { id: string; name: string; slug: string; status: string; plan: string };
  foundingMonths: number;
}) {
  const router = useRouter();
  const [planOpen, setPlanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const live = agency.status === "published";
  const next = live ? "draft" : "published";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {live && (
        <a href={`/agency/${agency.slug}`} target="_blank" rel="noopener" className={button}>
          View live
          <ArrowUpRight className="size-4 [stroke-width:1.5] text-text-2" aria-hidden />
        </a>
      )}
      <button type="button" className={button} onClick={() => setPlanOpen(true)}>
        Change plan…
      </button>
      <ConfirmDialog
        trigger={
          <button
            type="button"
            className={
              live
                ? button
                : "h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90"
            }
          >
            {live ? "Unpublish…" : "Publish agency"}
          </button>
        }
        title={live ? `Unpublish ${agency.name}?` : `Publish ${agency.name}?`}
        description={
          live
            ? "It disappears from the directory until you publish it again."
            : "It appears in the directory and search straight away."
        }
        confirmLabel={live ? "Unpublish" : "Publish agency"}
        tone={live ? "danger" : "default"}
        onConfirm={async () => {
          const res = await setAgenciesStatus([agency.id], next);
          if (!res.ok) return res.error;
          toast.success(live ? `Unpublished ${agency.name}` : `Published ${agency.name}`);
          router.refresh();
          return null;
        }}
      />
      <button
        type="button"
        className={`${button} text-destructive`}
        onClick={() => setDeleteOpen(true)}
      >
        Delete agency…
      </button>
      {deleteOpen && (
        <DeleteAgenciesDialog
          agencies={[{ id: agency.id, name: agency.name, status: agency.status }]}
          open
          onOpenChange={setDeleteOpen}
          onDeleted={() => router.push("/admin/agencies")}
        />
      )}
      {planOpen && (
        <ChangePlanDialog
          agencyId={agency.id}
          agencyName={agency.name}
          currentPlan={agency.plan}
          foundingMonths={foundingMonths}
          open
          onOpenChange={setPlanOpen}
        />
      )}
    </div>
  );
}
