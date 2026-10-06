"use client";

import Link from "next/link";
import { Dialog } from "radix-ui";
import { useState, useSyncExternalStore } from "react";

import { DeleteLeadButton } from "@/components/admin/delete-lead-button";
import { usePortalContainer } from "@/components/admin/portal";
import { DetailList } from "@/components/admin/ui";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export type LeadRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  need: string;
  budget: string | null;
  message: string | null;
  createdAt: string;
  routes: { agencyId: string; agencyName: string; claimed: boolean; sentAt: string }[];
};

// Hash links (#lead-<id>, from Ctrl K and the dashboard) open that lead's drawer.
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** Leads table; a row opens a drawer with the full inquiry and its routing (§5.5). */
export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const container = usePortalContainer();
  const hash = useSyncExternalStore(
    subscribeHash,
    () => location.hash,
    () => "",
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [closedHash, setClosedHash] = useState<string | null>(null);
  const hashId = hash.startsWith("#lead-") && hash !== closedHash ? hash.slice(6) : null;
  const open = leads.find((l) => l.id === (openId ?? hashId)) ?? null;

  const close = () => {
    setOpenId(null);
    setClosedHash(hash);
  };

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line lg:overflow-visible">
        <table className="w-full border-collapse text-left [&_td]:h-11 [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-2 [&_td]:align-middle [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:h-9 [&_th]:bg-bg [&_th]:px-4 [&_th]:text-[12px] [&_th]:leading-4 [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-text-2 [&_th]:shadow-[inset_0_-1px_0_var(--line)] lg:[&_th]:top-14 [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl">
          <thead>
            <tr>
              <th scope="col">From</th>
              <th scope="col">Company</th>
              <th scope="col">Looking for</th>
              <th scope="col">Budget</th>
              <th scope="col" className="text-right">
                Routed
              </th>
              <th scope="col" className="text-right">
                Received
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr
                key={l.id}
                id={`lead-${l.id}`}
                className={cn(
                  "cursor-pointer transition-colors duration-150 hover:bg-surface-2",
                  open?.id === l.id && "bg-surface-2",
                )}
                onClick={() => setOpenId(l.id)}
              >
                <td>
                  {/* The button makes each row reachable and openable by keyboard. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(l.id);
                    }}
                    className="text-left font-medium hover:underline"
                  >
                    {l.name}
                  </button>
                  <div className="text-admin-meta">{l.email}</div>
                </td>
                <td className="text-text-2">{l.company || "Not given"}</td>
                <td className="text-text-2">{l.need || "Contacted an agency directly"}</td>
                <td className="whitespace-nowrap text-text-2">{l.budget ?? "Not given"}</td>
                <td className={cn("text-right num", l.routes.length === 0 && "text-warning")}>
                  {l.routes.length === 0 ? "None" : l.routes.length}
                </td>
                <td className="text-right">
                  <time
                    dateTime={l.createdAt}
                    title={formatDateTime(l.createdAt)}
                    className="whitespace-nowrap text-text-2 num"
                  >
                    {formatRelative(l.createdAt)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog.Root open={!!open} onOpenChange={(o) => !o && close()}>
        <Dialog.Portal container={container}>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          {open && (
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 right-0 z-50 flex w-[min(520px,100vw)] flex-col gap-6 overflow-y-auto border-l border-line bg-bg p-6 text-text shadow-lg duration-200 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-8"
            >
              <div className="flex items-start justify-between gap-4">
                <Dialog.Title className="text-admin-section">{open.name}</Dialog.Title>
                <Dialog.Close className="h-8 rounded-lg px-2 text-text-2 hover:bg-surface-2 hover:text-text">
                  Close
                </Dialog.Close>
              </div>
              <DetailList
                rows={[
                  [
                    "Email",
                    <a
                      key="e"
                      href={`mailto:${open.email}`}
                      className="text-accent hover:underline"
                    >
                      {open.email}
                    </a>,
                  ],
                  ["Company", open.company],
                  ["Looking for", open.need || "Contacted an agency directly"],
                  ["Budget", open.budget],
                  [
                    "Received",
                    <span key="r" className="num">
                      {formatDateTime(open.createdAt)}
                    </span>,
                  ],
                ]}
              />
              {open.message && (
                <section aria-labelledby="lead-message" className="flex flex-col gap-2">
                  <h3 id="lead-message" className="font-medium">
                    Message
                  </h3>
                  <p className="whitespace-pre-line text-text-2">{open.message}</p>
                </section>
              )}
              <section aria-labelledby="lead-routes" className="flex flex-col gap-2">
                <h3 id="lead-routes" className="font-medium">
                  Sent to
                </h3>
                {open.routes.length === 0 ? (
                  <p className="text-warning">
                    No agency matched. Follow up by hand or recruit an agency for this need.
                  </p>
                ) : (
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {open.routes.map((r) => (
                      <li key={r.agencyId} className="flex items-baseline gap-3 px-4 py-2.5">
                        <span className="min-w-0 flex-1">
                          <Link href={`/admin/agencies/${r.agencyId}`} className="hover:underline">
                            {r.agencyName}
                          </Link>
                          {!r.claimed && <span className="text-admin-meta"> (unclaimed)</span>}
                        </span>
                        <time
                          dateTime={r.sentAt}
                          title={formatDateTime(r.sentAt)}
                          className="shrink-0 text-text-2 num"
                        >
                          {formatRelative(r.sentAt)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <div className="mt-auto border-t border-line pt-4">
                <DeleteLeadButton id={open.id} name={open.name} onDeleted={close} />
              </div>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
