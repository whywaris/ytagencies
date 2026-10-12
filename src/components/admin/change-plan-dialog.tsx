"use client";

import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { usePortalContainer } from "@/components/admin/portal";
import { PLAN_LABEL } from "@/components/admin/ui";
import { changePlan } from "@/lib/actions/admin-directory";

const PLANS = [
  { id: "free", hint: "Default. No paid entitlements." },
  { id: "founding", hint: "Pro for a limited time, plus the Founding badge for good." },
  { id: "pro", hint: "Paid plan, granted by hand while payments are off." },
] as const;

/** yyyy-mm-dd, `months` from today (UTC). */
function monthsFromNow(months: number) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Change plan… (§5.2 row menu, Plan & billing tab). Controlled from a menu item or a button. */
export function ChangePlanDialog({
  agencyId,
  agencyName,
  currentPlan,
  foundingMonths,
  open,
  onOpenChange,
}: {
  agencyId: string;
  agencyName: string;
  currentPlan: string;
  /** Default Founding term, from Settings (§5.10). */
  foundingMonths: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const container = usePortalContainer();
  const [plan, setPlan] = useState(currentPlan === "free" ? "founding" : currentPlan);
  const termFor = (p: string) => monthsFromNow(p === "founding" ? foundingMonths : 6);
  const [endsOn, setEndsOn] = useState(termFor(plan));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await changePlan(agencyId, { plan, endsOn: plan === "free" ? "" : endsOn });
      if (!res.ok) return setError(res.error);
      toast.success(`${agencyName} is now on ${PLAN_LABEL[plan]}`);
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-bg p-6 text-text shadow-lg duration-150 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <Dialog.Title className="text-admin-section">Change plan for {agencyName}</Dialog.Title>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <fieldset className="flex flex-col gap-1">
              <legend className="sr-only">Plan</legend>
              {PLANS.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 has-checked:bg-surface-2"
                >
                  <input
                    type="radio"
                    name="plan"
                    value={p.id}
                    checked={plan === p.id}
                    onChange={() => {
                      setPlan(p.id);
                      setEndsOn(termFor(p.id));
                    }}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {PLAN_LABEL[p.id]}
                      {p.id === currentPlan && (
                        <span className="font-normal text-text-2"> (current)</span>
                      )}
                    </span>
                    <span className="text-admin-meta">{p.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {plan !== "free" && (
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Ends on</span>
                <input
                  type="date"
                  value={endsOn}
                  min={monthsFromNow(0)}
                  onChange={(e) => setEndsOn(e.target.value)}
                  className="h-9 rounded-lg border border-line bg-bg px-3 num"
                />
                <span className="text-admin-meta">Leave empty for no end date.</span>
              </label>
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Dialog.Close className="h-9 rounded-lg border border-line px-3 font-medium hover:bg-surface-2">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Change plan"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
