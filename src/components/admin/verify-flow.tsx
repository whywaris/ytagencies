"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  lookupChannels,
  revokeVerification,
  saveVerification,
} from "@/lib/actions/admin-directory";
import { formatCount, formatDate } from "@/lib/format";
import type { ChannelResult, ChannelStats } from "@/lib/youtube";

const CHECKS = [
  { id: "ownership", label: "Proof that they own or manage these channels has been reviewed" },
  { id: "domain", label: "The agency's website domain matches their contact email or claim" },
  {
    id: "business",
    label: "The business looks real: site, team, clients and case studies check out",
  },
] as const;
type CheckId = (typeof CHECKS)[number]["id"];

/** Verification for one agency (ADMIN_V2_SPEC §5.4): look up channels, tick the checklist, decide. */
export function VerifyFlow({
  agency,
  initialUrls,
  verified,
  youtubeReady,
}: {
  agency: { id: string; name: string };
  initialUrls: string[];
  verified: boolean;
  youtubeReady: boolean;
}) {
  const router = useRouter();
  const [urls, setUrls] = useState(initialUrls.join("\n"));
  const [results, setResults] = useState<ChannelResult[] | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<CheckId, boolean>>({
    ownership: false,
    domain: false,
    business: false,
  });
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const found: ChannelStats[] = (results ?? []).flatMap((r) => (r.ok ? [r.stats] : []));
  const canApprove = found.length > 0 && CHECKS.every((c) => checks[c.id]);

  const lookup = () =>
    startTransition(async () => {
      setLookupError(null);
      const res = await lookupChannels(urls.split("\n"));
      if (!res.ok) {
        setResults(null);
        return setLookupError(res.error);
      }
      setResults(res.data);
    });

  const decide = async (decision: "approve" | "reject") => {
    const res = await saveVerification(agency.id, {
      decision,
      channels: found,
      checklist: checks,
      reason,
    });
    if (!res.ok) return res.error;
    toast.success(
      decision === "approve"
        ? `${agency.name} is verified`
        : `Verification rejected for ${agency.name}`,
    );
    router.push("/admin/verification");
    router.refresh();
    return null;
  };

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section aria-labelledby="channels" className="flex flex-col gap-3">
        <h2 id="channels" className="text-admin-section">
          1. Channels
        </h2>
        {!youtubeReady && (
          <p role="status" className="rounded-lg border border-line px-4 py-3 text-text-2">
            YOUTUBE_API_KEY isn&apos;t set on the server, so stats can&apos;t be fetched. Add it to
            the environment, then reload.
          </p>
        )}
        <label htmlFor="channel-urls" className="text-text-2">
          Paste the agency&apos;s YouTube channel URLs, one per line: /@handle, /channel/UC… or
          /user/name.
        </label>
        <textarea
          id="channel-urls"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={4}
          spellCheck={false}
          className="rounded-lg border border-line bg-bg px-3 py-2"
        />
        <button
          type="button"
          disabled={pending || !youtubeReady || !urls.trim()}
          onClick={lookup}
          className="h-9 self-start rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50"
        >
          {pending && !results ? "Looking up…" : "Look up channels"}
        </button>
        {lookupError && (
          <p role="alert" className="text-destructive">
            {lookupError}
          </p>
        )}
        {results && (
          <ul
            className="flex flex-col divide-y divide-line rounded-xl border border-line"
            aria-live="polite"
          >
            {results.map((r) =>
              r.ok ? (
                <li
                  key={r.input}
                  className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3"
                >
                  <a
                    href={r.stats.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {r.stats.title}
                  </a>
                  <span className="text-text-2 num">
                    {r.stats.subscribers === null
                      ? "Subscribers hidden"
                      : `${formatCount(r.stats.subscribers)} subscribers`}
                  </span>
                  <span className="text-text-2 num">{formatCount(r.stats.views)} views</span>
                  <span className="text-text-2 num">{formatCount(r.stats.videos)} videos</span>
                  <span className="text-text-2 num">Since {formatDate(r.stats.publishedAt)}</span>
                </li>
              ) : (
                <li key={r.input} className="flex flex-col px-4 py-3">
                  <span className="truncate">{r.input}</span>
                  <span className="text-destructive">{r.error}</span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-admin-section">2. Checklist</legend>
        {CHECKS.map((c) => (
          <label
            key={c.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2"
          >
            <input
              type="checkbox"
              checked={checks[c.id]}
              onChange={(e) => setChecks((s) => ({ ...s, [c.id]: e.target.checked }))}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            {c.label}
          </label>
        ))}
      </fieldset>

      <section aria-labelledby="decide" className="flex flex-col gap-3">
        <h2 id="decide" className="text-admin-section">
          3. Decision
        </h2>
        <p className="text-text-2">
          Approving shows the Verified badge on {agency.name}&apos;s profile and in the directory.
          Channel stats are fetched again on the server and re-checked every month.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ConfirmDialog
            trigger={
              <button
                type="button"
                disabled={!canApprove}
                className="h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
              >
                Approve verification
              </button>
            }
            title={`Verify ${agency.name}?`}
            description={`The Verified badge appears straight away, based on ${found.length} ${found.length === 1 ? "channel" : "channels"}.`}
            confirmLabel="Approve verification"
            tone="default"
            onConfirm={() => decide("approve")}
          />
          <ConfirmDialog
            trigger={
              <button
                type="button"
                className="h-9 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2"
              >
                Reject…
              </button>
            }
            title={`Reject verification for ${agency.name}?`}
            description="The request is closed. The reason is kept in the audit log."
            confirmLabel="Reject verification"
            onConfirm={() => decide("reject")}
          >
            <label className="flex flex-col gap-1.5">
              <span className="font-medium">
                Reason <span className="font-normal text-text-2">(optional)</span>
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                rows={3}
                className="rounded-lg border border-line bg-bg px-3 py-2"
              />
            </label>
          </ConfirmDialog>
          {!canApprove && (
            <p className="text-admin-meta">
              Look up at least one channel and tick every check to approve.
            </p>
          )}
        </div>
      </section>

      {verified && (
        <section aria-labelledby="revoke" className="flex flex-col gap-3 border-t border-line pt-6">
          <h2 id="revoke" className="text-admin-section">
            Remove the badge
          </h2>
          <ConfirmDialog
            trigger={
              <button
                type="button"
                className="h-9 self-start rounded-lg border border-line px-3 font-medium text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-destructive"
              >
                Revoke verification…
              </button>
            }
            title={`Revoke verification for ${agency.name}?`}
            description="The Verified badge disappears from the profile and the directory straight away."
            confirmLabel="Revoke verification"
            onConfirm={async () => {
              const res = await revokeVerification(agency.id, reason);
              if (!res.ok) return res.error;
              toast.success(`Revoked verification for ${agency.name}`);
              router.refresh();
              return null;
            }}
          >
            <label className="flex flex-col gap-1.5">
              <span className="font-medium">
                Reason{" "}
                <span className="font-normal text-text-2">(optional, for the audit log)</span>
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                rows={3}
                className="rounded-lg border border-line bg-bg px-3 py-2"
              />
            </label>
          </ConfirmDialog>
        </section>
      )}
    </div>
  );
}
