import Link from "next/link";

import { ActionButton, Empty, Pill, Table } from "@/components/admin/ui";
import { decideClaim } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { emailMatchesWebsite } from "@/lib/claims";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Claims" };

const date = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminClaimsPage() {
  await requireAdmin("/admin/claims");
  const db = createAdminClient();
  const { data: claims, error } = await db
    .from("claims")
    .select(
      "id, status, work_email, user_id, created_at, agencies(id, name, slug, website, is_claimed)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Couldn't load claims");

  // Account emails for context. ponytail: one auth lookup per claim; batch if the queue grows past ~100.
  const accounts = new Map(
    await Promise.all(
      [...new Set(claims.map((c) => c.user_id))].map(
        async (uid) =>
          [uid, (await db.auth.admin.getUserById(uid)).data.user?.email ?? null] as const,
      ),
    ),
  );
  const pending = claims.filter((c) => c.status === "pending");
  const decided = claims.filter((c) => c.status !== "pending").slice(0, 30);

  const rows = (list: typeof claims) =>
    list.map((c) => {
      const match = c.agencies ? emailMatchesWebsite(c.work_email, c.agencies.website) : false;
      return (
        <tr key={c.id}>
          <td>
            {c.agencies ? (
              <Link
                href={`/admin/agencies/${c.agencies.id}`}
                className="font-medium hover:underline"
              >
                {c.agencies.name}
              </Link>
            ) : (
              "Deleted agency"
            )}
            <div className="text-small">{c.agencies?.website ?? "No website"}</div>
          </td>
          <td>
            {c.work_email}
            <div className="text-small">
              {match ? "Matches website domain" : "Doesn't match website"}
            </div>
          </td>
          <td className="text-text-2">{accounts.get(c.user_id) ?? "Unknown"}</td>
          <td className="whitespace-nowrap text-text-2">{date(c.created_at)}</td>
          <td>
            {c.status === "pending" ? (
              <div className="flex gap-4">
                {c.agencies?.is_claimed ? (
                  <span className="text-small">Already claimed</span>
                ) : (
                  <ActionButton action={decideClaim.bind(null, c.id, "approve")}>
                    Approve<span className="sr-only"> claim for {c.agencies?.name}</span>
                  </ActionButton>
                )}
                <ActionButton action={decideClaim.bind(null, c.id, "reject")} tone="danger">
                  Reject<span className="sr-only"> claim for {c.agencies?.name}</span>
                </ActionButton>
              </div>
            ) : (
              <Pill on={c.status === "approved"}>{c.status}</Pill>
            )}
          </td>
        </tr>
      );
    });

  const head = (
    <thead>
      <tr>
        <th scope="col">Agency</th>
        <th scope="col">Work email</th>
        <th scope="col">Account</th>
        <th scope="col">Submitted</th>
        <th scope="col">
          <span className="sr-only">Decision</span>
        </th>
      </tr>
    </thead>
  );

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4" aria-labelledby="pending-claims">
        <h1 id="pending-claims" className="text-h2">
          Claims to review
        </h1>
        <p className="max-w-reading text-text-2">
          Approving gives the account full control of the listing. Check the work email against the
          agency&apos;s website and team before approving.
        </p>
        {pending.length ? (
          <Table>
            {head}
            <tbody>{rows(pending)}</tbody>
          </Table>
        ) : (
          <Empty>No claims waiting.</Empty>
        )}
      </section>
      {decided.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="decided-claims">
          <h2 id="decided-claims" className="text-h3">
            Recently decided
          </h2>
          <Table>
            {head}
            <tbody>{rows(decided)}</tbody>
          </Table>
        </section>
      )}
    </div>
  );
}
