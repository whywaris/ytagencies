import Link from "next/link";

import { ActionButton, Empty, Table } from "@/components/admin/ui";
import { decideSubmission } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { emailMatchesWebsite } from "@/lib/claims";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "New submissions" };

const date = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminSubmissionsPage() {
  await requireAdmin("/admin/submissions");
  const db = createAdminClient();
  const { data: agencies, error } = await db
    .from("agencies")
    .select(
      "id, name, website, description, owner_id, submitted_by, created_at, agency_services(services(name)), agency_industries(industries(name)), claims(user_id, work_email, status)",
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

  return (
    <section className="flex flex-col gap-4" aria-labelledby="submissions">
      <h1 id="submissions" className="text-h2">
        New submissions
      </h1>
      <p className="max-w-reading text-text-2">
        Agencies added through List your agency. Approving publishes the listing and, if the
        submitter hasn&apos;t confirmed their work email yet, gives them control of it. Rejecting
        deletes the draft.
      </p>
      {agencies.length ? (
        <Table>
          <thead>
            <tr>
              <th scope="col">Agency</th>
              <th scope="col">Services and industries</th>
              <th scope="col">Submitted by</th>
              <th scope="col">
                <span className="sr-only">Decision</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {agencies.map((a) => {
              const claim = a.claims.find(
                (c) => c.user_id === a.submitted_by && c.status !== "rejected",
              );
              const match = claim ? emailMatchesWebsite(claim.work_email, a.website) : false;
              return (
                <tr key={a.id}>
                  <td className="max-w-80">
                    <Link href={`/admin/agencies/${a.id}`} className="font-medium hover:underline">
                      {a.name}
                    </Link>
                    <div className="text-small">{a.website ?? "No website"}</div>
                    <p className="mt-2 line-clamp-3 text-small">{a.description}</p>
                  </td>
                  <td className="text-small">
                    {a.agency_services.map((s) => s.services.name).join(", ")}
                    <div>{a.agency_industries.map((i) => i.industries.name).join(", ")}</div>
                  </td>
                  <td>
                    {claim?.work_email ?? "No work email"}
                    <div className="text-small">
                      {a.owner_id
                        ? "Confirmed via work email"
                        : match
                          ? "Matches website, not confirmed yet"
                          : "Doesn't match website"}
                    </div>
                    <div className="text-small">
                      {accounts.get(a.submitted_by!) ?? "Unknown"} · {date(a.created_at)}
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-4">
                      <ActionButton action={decideSubmission.bind(null, a.id, "approve")}>
                        Publish<span className="sr-only"> {a.name}</span>
                      </ActionButton>
                      <ActionButton
                        action={decideSubmission.bind(null, a.id, "reject")}
                        tone="danger"
                      >
                        Reject<span className="sr-only"> {a.name}</span>
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <Empty>No new submissions.</Empty>
      )}
    </section>
  );
}
