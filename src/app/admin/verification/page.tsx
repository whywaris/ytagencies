import { Search } from "lucide-react";
import Link from "next/link";

import { Empty, PlanBadge, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatRelative } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Verification" };

const PAID = new Set(["pro"]);

export default async function AdminVerificationPage({
  searchParams,
}: PageProps<"/admin/verification">) {
  await requireAdmin("/admin/verification");
  const q = (typeof (await searchParams).q === "string" ? String((await searchParams).q) : "")
    .replace(/[^\p{L}\p{N} .-]/gu, " ")
    .trim()
    .slice(0, 100);

  const db = createAdminClient();
  const [requests, matches] = await Promise.all([
    db
      .from("verifications")
      .select("id, agency_id, created_at, agencies(name, slug, website)")
      .eq("status", "requested")
      .order("created_at", { ascending: true })
      .limit(200),
    q
      ? db
          .from("admin_agency_list")
          .select("id, name, slug, website, is_verified, plan")
          .or(`name.ilike.*${q}*,website.ilike.*${q}*,slug.ilike.*${q}*`)
          .order("name")
          .limit(10)
      : null,
  ]);
  if (requests.error || matches?.error) throw new Error("Couldn't load verification requests");

  // §6: any plan can request verification; Free requests are queued behind paid ones.
  const plans = new Map<string, string>();
  if (requests.data.length) {
    const { data, error } = await db
      .from("admin_agency_list")
      .select("id, plan")
      .in(
        "id",
        requests.data.map((r) => r.agency_id),
      );
    if (error) throw new Error("Couldn't load plans");
    for (const p of data) plans.set(p.id, p.plan);
  }
  const queue = [...requests.data].sort(
    (a, b) =>
      Number(PAID.has(plans.get(b.agency_id) ?? "free")) -
        Number(PAID.has(plans.get(a.agency_id) ?? "free")) ||
      a.created_at.localeCompare(b.created_at),
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex max-w-reading flex-col gap-1">
        <h1 className="text-admin-title">Verification</h1>
        <p className="text-text-2">
          Requests from agencies, Pro first. Verifying checks their YouTube channels and shows the
          Verified badge.
        </p>
      </div>

      <section aria-labelledby="requests" className="flex flex-col gap-4">
        <h2 id="requests" className="text-admin-section">
          Requests
        </h2>
        {queue.length === 0 ? (
          <Empty>No verification requests waiting. You can still verify any agency below.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th scope="col">Agency</th>
                <th scope="col">Plan</th>
                <th scope="col">Requested</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="font-medium">{r.agencies?.name ?? "Deleted agency"}</span>
                    <div className="text-admin-meta">
                      {r.agencies?.website?.replace(/^https?:\/\/(www\.)?/, "") ?? "No website"}
                    </div>
                  </td>
                  <td>
                    <PlanBadge plan={plans.get(r.agency_id) ?? "free"} />
                  </td>
                  <td>
                    <time
                      dateTime={r.created_at}
                      title={formatDateTime(r.created_at)}
                      className="text-text-2 num"
                    >
                      {formatRelative(r.created_at)}
                    </time>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/admin/verification/${r.agency_id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      Review<span className="sr-only"> {r.agencies?.name}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="verify-any" className="flex max-w-2xl flex-col gap-4">
        <h2 id="verify-any" className="text-admin-section">
          Verify any agency
        </h2>
        <form method="get" role="search" className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 [stroke-width:1.5] text-text-2"
            aria-hidden
          />
          <label htmlFor="verify-q" className="sr-only">
            Find an agency
          </label>
          <input
            id="verify-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Find an agency by name, website or slug"
            className="h-9 w-full rounded-lg border border-line bg-bg pr-3 pl-9 placeholder:text-text-2"
          />
        </form>
        {matches &&
          (matches.data.length === 0 ? (
            <p className="text-text-2">No agencies match &ldquo;{q}&rdquo;.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {matches.data.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/verification/${a.id}`}
                    className="flex h-11 items-center gap-3 px-4 transition-colors duration-150 hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span className="text-admin-meta">
                      {a.is_verified ? "Verified" : "Not verified"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}
