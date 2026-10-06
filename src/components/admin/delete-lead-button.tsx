"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { deleteLead } from "@/lib/actions/admin";

export function DeleteLeadButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <button
          type="button"
          className="min-h-9 self-start text-text-2 hover:text-destructive hover:underline"
        >
          Delete<span className="sr-only"> lead from {name}</span>
        </button>
      }
      title={`Delete ${name}'s request?`}
      description="This removes the lead and its routing record permanently. It can't be undone."
      confirmLabel="Delete lead"
      onConfirm={async () => {
        const res = await deleteLead(id);
        if (!res.ok) return res.error;
        toast.success(`Deleted ${name}'s request`);
        router.refresh();
        return null;
      }}
    />
  );
}
