import Link from "next/link";

import { Queue, type QueueItem } from "@/components/admin/queue";
import { DetailList } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { emailMatchesWebsite } from "@/lib/claims";
import { formatCount } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Submissions" };

export default async function AdminSubmissionsPage() {
  await requireAdmin("/admin/submissions");
  const db = createAdminClient();
  const { data: agencies, error } = await db
    .from("agencies")
    .select(
      "id, name, slug, website, description, min_budget_usd, owner_id, submitted_by, created_at, agency_services(services(name)), agency_industries(industries(name)), agency_locations(locations(name)), claims(user_id, work_email, status), agency_subscriptions(source, status, external_id)",
    )
    .eq("status", "draft")
    .not("submitted_by", "is", null)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error("Couldn't load submissions");

  // ponytail: one auth lookup per submitter; batch if the queue grows past ~100.
  const accounts = new Map(
    await Promise.all(
      [...new Set(agencies.map((a) => a.submitted_by!))].map(
        async (uid) =>
          [uid, (await db.auth.admin.getUserById(uid)).data.user?.email ?? null] as const,
      ),
    ),
  );

  const items: QueueItem[] = agencies.map((a) => {
    const claim = a.claims.find((c) => c.user_id === a.submitted_by && c.status !== "rejected");
    const match = claim ? emailMatchesWebsite(claim.work_email, a.website) : false;
    // "Subscribe now" when submitting: rejecting deletes the draft but not the Creem charge.
    const paid = a.agency_subscriptions.find(
      (s) => s.source === "payment" && (s.status === "active" || s.status === "past_due"),
    );
    return {
      id: a.id,
      title: a.name,
      meta: a.website?.replace(/^https?:\/\/(www\.)?/, "") ?? "No website",
      since: a.created_at,
      detail: (
        <>
          {paid && (
            <p role="note" className="max-w-reading rounded-lg border border-line bg-surface-2 p-3">
              Paid for Pro when submitting (Creem subscription{" "}
              <span className="font-mono text-[12px]">{paid.external_id}</span>). If you reject it,
              refund and cancel that subscription in the Creem dashboard too.
            </p>
          )}
          <DetailList
            rows={[
              [
                "Website",
                a.website && (
                  <a
                    href={a.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-accent hover:underline"
                  >
                    {a.website}
                  </a>
                ),
              ],
              ["Work email", claim?.work_email ?? "None given"],
              [
                "Domain check",
                a.owner_id
                  ? "Confirmed by email link"
                  : match
                    ? "Matches the website, not confirmed yet"
                    : "Doesn't match the website",
              ],
              ["Signed in as", accounts.get(a.submitted_by!) ?? "Unknown"],
              ["Services", a.agency_services.map((s) => s.services.name).join(", ")],
              ["Industries", a.agency_industries.map((i) => i.industries.name).join(", ")],
              ["Locations", a.agency_locations.map((l) => l.locations.name).join(", ")],
              [
                "Minimum budget",
                a.min_budget_usd !== null && (
                  <span className="num">${formatCount(a.min_budget_usd)} a month</span>
                ),
              ],
            ]}
          />
          {a.description && <p className="max-w-reading whitespace-pre-wrap">{a.description}</p>}
          <Link href={`/admin/agencies/${a.id}`} className="self-start text-accent hover:underline">
            Edit before publishing
          </Link>
        </>
      ),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-reading flex-col gap-1">
        <h1 className="text-admin-title">Submissions</h1>
        <p className="text-text-2">
          Agencies added through List your agency. Publishing makes the listing live and, if the
          submitter hasn&apos;t confirmed their work email yet, gives them control of it.
        </p>
      </div>
      <Queue
        kind="submission"
        items={items}
        approveLabel="Publish agency"
        rejectLabel="Reject submission"
        rejectWarning="The draft is deleted and the submitter is told by email."
        empty="No new agencies waiting. Submissions from List your agency appear here."
      />
    </div>
  );
}
