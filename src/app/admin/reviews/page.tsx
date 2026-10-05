import Link from "next/link";

import { ActionButton, Empty, Table } from "@/components/admin/ui";
import { decideReview } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Reviews" };

export default async function AdminReviewsPage() {
  await requireAdmin("/admin/reviews");
  const { data: reviews, error } = await createAdminClient()
    .from("reviews")
    .select("id, author_name, author_company, rating, body, created_at, agencies(id, name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true }); // oldest first
  if (error) throw new Error("Couldn't load reviews");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h2">Reviews to moderate</h1>
      <p className="max-w-reading text-text-2">
        Publish only genuine reviews from real clients. Published reviews count towards the
        agency&apos;s rating and its structured data.
      </p>
      {reviews.length === 0 ? (
        <Empty>No reviews waiting.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">Agency</th>
              <th scope="col">Rating</th>
              <th scope="col">Review</th>
              <th scope="col">Author</th>
              <th scope="col">
                <span className="sr-only">Decision</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.agencies ? (
                    <Link
                      href={`/admin/agencies/${r.agencies.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.agencies.name}
                    </Link>
                  ) : (
                    "Deleted agency"
                  )}
                </td>
                <td className="whitespace-nowrap">{r.rating} / 5</td>
                <td className="max-w-[40ch] whitespace-pre-line">{r.body}</td>
                <td className="text-text-2">
                  {r.author_name}
                  {r.author_company && <div className="text-small">{r.author_company}</div>}
                  <div className="text-small">
                    {new Date(r.created_at).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </td>
                <td>
                  <div className="flex gap-4">
                    <ActionButton action={decideReview.bind(null, r.id, "published")}>
                      Publish<span className="sr-only"> review by {r.author_name}</span>
                    </ActionButton>
                    <ActionButton action={decideReview.bind(null, r.id, "rejected")} tone="danger">
                      Reject<span className="sr-only"> review by {r.author_name}</span>
                    </ActionButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
