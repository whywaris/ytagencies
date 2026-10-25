"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { setAgenciesStatus } from "@/lib/actions/admin-directory";
import { deleteMessage, setMessageStatus } from "@/lib/actions/admin-inbox";

const secondary =
  "h-9 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50";

/** Close/reopen and delete for one contact message. */
export function InboxActions({
  id,
  name,
  status,
}: {
  id: string;
  name: string;
  status: "open" | "closed";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = status === "open" ? "closed" : "open";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await setMessageStatus(id, next);
            if (!res.ok) return void toast.error(res.error);
            toast.success(next === "closed" ? "Marked as closed" : "Reopened");
            router.refresh();
          })
        }
        className={
          status === "open"
            ? "h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
            : secondary
        }
      >
        {status === "open" ? "Mark as closed" : "Reopen"}
      </button>
      <ConfirmDialog
        trigger={
          <button type="button" className={`${secondary} text-text-2 hover:text-destructive`}>
            Delete…
          </button>
        }
        title={`Delete ${name}'s message?`}
        description="It's removed permanently, for example when someone asks for their data to be deleted. It can't be undone."
        confirmLabel="Delete message"
        onConfirm={async () => {
          const res = await deleteMessage(id);
          if (!res.ok) return res.error;
          toast.success("Message deleted");
          router.push("/admin/inbox");
          return null;
        }}
      />
    </div>
  );
}

/** "Remove my listing" requests: archive the agency in one click (it leaves every public page). */
export function ArchiveListingButton({ agencyId }: { agencyId: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <button type="button" className={secondary}>
          Archive listing…
        </button>
      }
      title="Archive this listing?"
      description="It's taken off the site and out of search at once, and no more outreach goes to it. You can publish it again from Agencies."
      confirmLabel="Archive listing"
      onConfirm={async () => {
        const res = await setAgenciesStatus([agencyId], "archived");
        if (!res.ok) return res.error;
        toast.success("Listing archived");
        router.refresh();
        return null;
      }}
    />
  );
}
