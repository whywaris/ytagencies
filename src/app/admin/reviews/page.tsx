import Link from "next/link";

import { Queue, type QueueItem } from "@/components/admin/queue";
import { DetailList, StatusBadge } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Reviews" };

export default async function AdminReviewsPage() {
  await requireAdmin("/admin/reviews");
  const db = createAdminClient();
  const [{ data: reviews, error }, all] = await Promise.all([
    db
      .from("reviews")
      .select(
        "id, author_name, author_company, author_id, rating, body, created_at, agencies(id, name)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }), // oldest first
    db
      .from("reviews")
      .select(
        "id, author_name, rating, overall, status, verified_client, created_at, agencies(name)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (error || all.error) throw new Error("Couldn't load reviews");

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
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-admin-title">Reviews</h1>
          <Link
            href="/admin/reviews/new"
            className="flex h-9 items-center rounded-lg bg-accent px-3 font-medium text-on-accent hover:bg-(--accent-hover)"
          >
            New review
          </Link>
        </div>
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

      <section aria-labelledby="all-reviews" className="flex flex-col gap-3">
        <h2 id="all-reviews" className="text-admin-section">
          All reviews
        </h2>
        {all.data.length === 0 ? (
          <p className="text-text-2">No reviews yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {all.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <Link href={`/admin/reviews/${r.id}`} className="font-medium hover:underline">
                  {r.author_name}
                </Link>
                <span className="text-text-2">{r.agencies?.name ?? "Deleted agency"}</span>
                <span className="text-text-2 num">
                  {r.overall !== null ? Number(r.overall).toFixed(2) : `${r.rating} / 5`}
                </span>
                {r.verified_client && <span className="text-success">Verified client</span>}
                <span className="ml-auto flex items-center gap-4">
                  <StatusBadge status={r.status} />
                  <span className="text-admin-meta num">{formatDate(r.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
