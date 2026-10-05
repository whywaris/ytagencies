import Link from "next/link";

import { ActionButton, Pill, Table } from "@/components/admin/ui";
import { setAgencyStatus, toggleAgencyFlag } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Agencies" };

const FILTERS = ["all", "published", "draft", "archived"] as const;

export default async function AdminAgenciesPage({ searchParams }: PageProps<"/admin/agencies">) {
  await requireAdmin("/admin/agencies");
  const raw = (await searchParams).status;
  const filter = FILTERS.find((f) => f === raw) ?? "all";

  let query = createAdminClient()
    .from("agencies")
    .select("id, name, slug, status, is_verified, is_featured, is_claimed, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500); // ponytail: no pagination yet; add ?page= past ~500 agencies
  if (filter !== "all") query = query.eq("status", filter);
  const { data: agencies, error } = await query;
  if (error) throw new Error("Couldn't load agencies");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2">Agencies</h1>
        <Link
          href="/admin/agencies/new"
          className="inline-flex h-11 items-center rounded-full bg-accent px-6 font-medium text-on-accent hover:bg-accent/90"
        >
          New agency
        </Link>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-x-6 text-small">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/agencies" : `/admin/agencies?status=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className="flex min-h-11 items-center capitalize hover:text-text aria-[current=page]:font-medium aria-[current=page]:text-text"
          >
            {f}
          </Link>
        ))}
      </nav>

      <Table>
        <thead>
          <tr>
            <th scope="col">Agency</th>
            <th scope="col">Status</th>
            <th scope="col">Verified</th>
            <th scope="col">Featured</th>
            <th scope="col">Claimed</th>
            <th scope="col">Updated</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {agencies.map((a) => {
            const published = a.status === "published";
            return (
              <tr key={a.id}>
                <td>
                  <Link href={`/admin/agencies/${a.id}`} className="font-medium hover:underline">
                    {a.name}
                  </Link>
                  <div className="text-small">/{a.slug}</div>
                </td>
                <td>
                  <Pill on={published}>{a.status}</Pill>
                </td>
                <td>
                  <ActionButton action={toggleAgencyFlag.bind(null, a.id, "is_verified")}>
                    {a.is_verified ? "Yes · remove" : "No · verify"}
                    <span className="sr-only"> {a.name}</span>
                  </ActionButton>
                </td>
                <td>
                  <ActionButton action={toggleAgencyFlag.bind(null, a.id, "is_featured")}>
                    {a.is_featured ? "Yes · remove" : "No · feature"}
                    <span className="sr-only"> {a.name}</span>
                  </ActionButton>
                </td>
                <td className="text-text-2">{a.is_claimed ? "Yes" : "No"}</td>
                <td className="whitespace-nowrap text-text-2">
                  {new Date(a.updated_at).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td>
                  <ActionButton
                    action={setAgencyStatus.bind(null, a.id, published ? "draft" : "published")}
                    tone={published ? "danger" : "default"}
                  >
                    {published ? "Unpublish" : "Publish"}
                    <span className="sr-only"> {a.name}</span>
                  </ActionButton>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {agencies.length === 0 && <p className="text-text-2">No agencies with this status.</p>}
    </div>
  );
}
