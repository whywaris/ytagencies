"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { deleteLead } from "@/lib/actions/admin";

/** Deletes a lead on request (privacy / GDPR), after a confirmation naming the person. */
export function DeleteLeadButton({
  id,
  name,
  onDeleted,
}: {
  id: string;
  name: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <button
          type="button"
          className="h-9 rounded-lg border border-line px-3 font-medium text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-destructive"
        >
          Delete lead…
        </button>
      }
      title={`Delete ${name}'s request?`}
      description="This removes the lead and its routing record permanently, for example when they ask for their data to be deleted. Ask the agencies it was sent to to delete their copy too. It can't be undone."
      confirmLabel="Delete lead"
      onConfirm={async () => {
        const res = await deleteLead(id);
        if (!res.ok) return res.error;
        toast.success(`Deleted ${name}'s request`);
        onDeleted?.();
        router.refresh();
        return null;
      }}
    />
  );
}
