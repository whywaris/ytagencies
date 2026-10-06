import Link from "next/link";

import { Queue, type QueueItem } from "@/components/admin/queue";
import { DetailList } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Reviews" };

export default async function AdminReviewsPage() {
  await requireAdmin("/admin/reviews");
  const { data: reviews, error } = await createAdminClient()
    .from("reviews")
    .select(
      "id, author_name, author_company, author_id, rating, body, created_at, agencies(id, name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true }); // oldest first
  if (error) throw new Error("Couldn't load reviews");

  const items: QueueItem[] = reviews.map((r) => ({
    id: r.id,
    title: `${r.author_name} on ${r.agencies?.name ?? "a deleted agency"}`,
    meta: `${r.rating} out of 5`,
    since: r.created_at,
    detail: (
      <>
        <DetailList
          rows={[
            [
              "Agency",
              r.agencies ? (
                <Link
                  href={`/admin/agencies/${r.agencies.id}`}
                  className="text-accent hover:underline"
                >
                  {r.agencies.name}
                </Link>
              ) : (
                "Deleted agency"
              ),
            ],
            [
              "Rating",
              <span key="r" className="num">
                {r.rating} out of 5
              </span>,
            ],
            ["Author", r.author_name],
            ["Company", r.author_company],
            [
              "Account",
              r.author_id
                ? "Linked, so a rejection reason is emailed"
                : "No account, nothing is emailed",
            ],
          ]}
        />
        <blockquote className="max-w-reading border-l-2 border-line pl-4 whitespace-pre-line">
          {r.body}
        </blockquote>
      </>
    ),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-reading flex-col gap-1">
        <h1 className="text-admin-title">Reviews</h1>
        <p className="text-text-2">
          Publish only genuine reviews from real clients. Published reviews count towards the
          agency&apos;s rating and its structured data.
        </p>
      </div>
      <Queue
        kind="review"
        items={items}
        approveLabel="Publish review"
        rejectLabel="Reject review"
        rejectWarning="The review stays hidden. If it's linked to an account, the author is told by email."
        empty="No reviews waiting for moderation."
      />
    </div>
  );
}
