import Link from "next/link";

import { Queue, type QueueItem } from "@/components/admin/queue";
import { DetailList } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { emailMatchesWebsite } from "@/lib/claims";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Claims" };

export default async function AdminClaimsPage() {
  await requireAdmin("/admin/claims");
  const db = createAdminClient();
  const { data: claims, error } = await db
    .from("claims")
    .select(
      "id, work_email, user_id, created_at, agencies!inner(id, name, slug, website, is_claimed, status)",
    )
    .eq("status", "pending")
    // Claims on new submissions are decided in Submissions instead.
    .neq("agencies.status", "draft")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error("Couldn't load claims");

  // ponytail: one auth lookup per claimant; batch if the queue grows past ~100.
  const accounts = new Map(
    await Promise.all(
      [...new Set(claims.map((c) => c.user_id))].map(
        async (uid) =>
          [uid, (await db.auth.admin.getUserById(uid)).data.user?.email ?? null] as const,
      ),
    ),
  );

  const items: QueueItem[] = claims.map((c) => {
    const match = emailMatchesWebsite(c.work_email, c.agencies.website);
    return {
      id: c.id,
      title: c.agencies.name,
      meta: c.work_email,
      since: c.created_at,
      detail: (
        <>
          <DetailList
            rows={[
              [
                "Agency",
                <Link
                  key="a"
                  href={`/admin/agencies/${c.agencies.id}`}
                  className="text-accent hover:underline"
                >
                  {c.agencies.name}
                </Link>,
              ],
              ["Website", c.agencies.website ?? "None listed"],
              ["Work email", c.work_email],
              ["Domain check", match ? "Matches the website" : "Doesn't match the website"],
              ["Signed in as", accounts.get(c.user_id) ?? "Unknown"],
              ["Listing", c.agencies.is_claimed ? "Already claimed by someone else" : "Unclaimed"],
            ]}
          />
          <p className="max-w-reading text-text-2">
            Approving gives this account full control of the listing. Check the work email against
            the agency&apos;s website and team first.
          </p>
        </>
      ),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-admin-title">Claims</h1>
      <Queue
        kind="claim"
        items={items}
        approveLabel="Approve claim"
        rejectLabel="Reject claim"
        rejectWarning="The claim is closed and the person is told by email."
        empty="No claims waiting. Claims whose work email didn't match the agency's domain appear here."
      />
    </div>
  );
}
