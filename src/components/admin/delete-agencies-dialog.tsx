"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { deleteAgencies } from "@/lib/actions/admin-directory";

/**
 * Permanent delete for one or more agencies. Says exactly what goes, warns when a public page will
 * stop working (Archive is the reversible option), and only enables the button once the admin has
 * typed the agency's name, or the number of agencies for a bulk delete.
 */
export function DeleteAgenciesDialog({
  agencies,
  open,
  onOpenChange,
  onDeleted,
}: {
  agencies: { id: string; name: string; status: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const single = agencies.length === 1;
  const expected = single ? agencies[0].name : String(agencies.length);
  const published = agencies.filter((a) => a.status === "published");

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
      title={
        single
          ? `Delete ${agencies[0].name} permanently?`
          : `Delete ${agencies.length} agencies permanently?`
      }
      description={
        <>
          This removes {single ? "the agency" : "these agencies"} with {single ? "its" : "their"}{" "}
          services, industries and locations, case studies, reviews, verification, plan, sponsored
          places, claims, profile statistics and uploaded files. Leads {single ? "it" : "they"}{" "}
          received are kept and show the name as deleted. It can&apos;t be undone.
        </>
      }
      confirmLabel={single ? "Delete agency" : `Delete ${agencies.length} agencies`}
      confirmDisabled={typed.trim() !== expected}
      onConfirm={async () => {
        const res = await deleteAgencies(agencies.map((a) => a.id));
        if (!res.ok) return res.error;
        toast.success(
          res.data.count === 1 && res.data.name
            ? `Deleted ${res.data.name}`
            : `Deleted ${res.data.count} agencies`,
        );
        setTyped("");
        onDeleted();
        return null;
      }}
    >
      {published.length > 0 && (
        <p className="rounded-lg border border-line px-3 py-2.5 text-text-2">
          {single
            ? "It's published, so its public page stops working straight away."
            : `${published.length} of them ${published.length === 1 ? "is" : "are"} published, so ${published.length === 1 ? "its public page stops" : "their public pages stop"} working straight away.`}{" "}
          To hide {single ? "it" : "them"} and keep everything, archive instead.
        </p>
      )}
      <label className="flex flex-col gap-1.5">
        <span>
          {single ? (
            <>
              Type <strong className="font-semibold">{expected}</strong> to confirm
            </>
          ) : (
            <>
              Type the number of agencies, <strong className="font-semibold num">{expected}</strong>
              , to confirm
            </>
          )}
        </span>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          inputMode={single ? "text" : "numeric"}
          className="h-9 rounded-lg border border-line bg-bg px-3"
        />
      </label>
    </ConfirmDialog>
  );
}
