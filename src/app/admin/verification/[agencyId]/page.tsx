import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChannelTable } from "@/components/admin/channel-table";
import { VerifyFlow } from "@/components/admin/verify-flow";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatRelative } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { youtubeConfigured, type StatsSnapshot } from "@/lib/youtube";

export const metadata = { title: "Verify agency" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VerifyAgencyPage({
  params,
}: PageProps<"/admin/verification/[agencyId]">) {
  const { agencyId } = await params;
  await requireAdmin(`/admin/verification/${agencyId}`);
  if (!UUID.test(agencyId)) notFound();

  const db = createAdminClient();
  const [{ data: agency }, { data: rows, error }] = await Promise.all([
    db.from("agencies").select("id, name, website, is_verified").eq("id", agencyId).maybeSingle(),
    db
      .from("verifications")
      .select("status, channels, stats_snapshot, created_at, reviewed_at")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (!agency) notFound();
  if (error) throw new Error("Couldn't load verification");

  const approved = rows.find((v) => v.status === "approved");
  const requested = rows.find((v) => v.status === "requested");
  const snapshot = (approved?.stats_snapshot ?? null) as StatsSnapshot | null;
  // Start from the channels on the open request, else the current approval.
  const source = (requested ?? approved)?.channels;
  const initialUrls = Array.isArray(source)
    ? source.flatMap((c) =>
        c && typeof c === "object" && "url" in c && typeof c.url === "string" ? [c.url] : [],
      )
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-admin-title">Verify {agency.name}</h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-text-2">
          {agency.is_verified ? (
            <span className="inline-flex items-center gap-1 text-success">
              <BadgeCheck className="size-4 [stroke-width:1.5]" aria-hidden />
              Verified
              {approved?.reviewed_at && (
                <span className="num">&nbsp;since {formatDate(approved.reviewed_at)}</span>
              )}
            </span>
          ) : requested ? (
            <span className="num">Requested {formatRelative(requested.created_at)}</span>
          ) : (
            <span>Not verified</span>
          )}
          {agency.website && <span>{agency.website.replace(/^https?:\/\/(www\.)?/, "")}</span>}
          <Link href={`/admin/agencies/${agency.id}`} className="text-accent hover:underline">
            Agency details
          </Link>
        </p>
      </div>

      {snapshot && (
        <section aria-labelledby="current" className="flex max-w-3xl flex-col gap-3">
          <h2 id="current" className="text-admin-section">
            Current channels
          </h2>
          <p className="text-admin-meta num">
            Last checked {formatDate(snapshot.latest.fetchedAt)}. Re-checked automatically every
            month.
          </p>
          <ChannelTable channels={snapshot.latest.channels} />
        </section>
      )}

      <VerifyFlow
        agency={{ id: agency.id, name: agency.name }}
        initialUrls={initialUrls}
        verified={agency.is_verified}
        youtubeReady={youtubeConfigured()}
      />
    </div>
  );
}
