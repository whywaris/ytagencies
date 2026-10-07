"use client";

import { useState } from "react";

import { ChangePlanDialog } from "@/components/admin/change-plan-dialog";

/** "Change plan…" for a table row; the dialog only mounts when opened. */
export function ChangePlanButton(props: {
  agencyId: string;
  agencyName: string;
  currentPlan: string;
  foundingMonths: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-accent hover:underline">
        Change plan…<span className="sr-only"> for {props.agencyName}</span>
      </button>
      {open && <ChangePlanDialog {...props} open onOpenChange={setOpen} />}
    </>
  );
}
