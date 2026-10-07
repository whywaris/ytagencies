import Link from "next/link";

import { Empty, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { formatCount, formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Authors" };

const STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/agency-media/`;

export default async function AdminAuthorsPage() {
  await requireAdmin("/admin/authors");
  const { data, error } = await createAdminClient()
    .from("authors")
    .select("id, slug, name, role, avatar_path, updated_at, guides(status, published_at)")
    .order("name");
  if (error) throw new Error("Couldn't load authors");
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-admin-title">Authors</h1>
          <p className="text-text-2">
            Shown in guide bylines. An author&apos;s page is public once they have a live guide.
          </p>
        </div>
        <Button asChild className="h-9 px-4 text-[14px]">
          <Link href="/admin/authors/new">New author</Link>
        </Button>
      </div>

      {data.length === 0 ? (
        <Empty action={{ href: "/admin/authors/new", label: "Add an author" }}>
          No authors yet.
        </Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">Author</th>
              <th scope="col">Role</th>
              <th scope="col" className="text-right">
                Live guides
              </th>
              <th scope="col" className="text-right">
                All guides
              </th>
              <th scope="col">Updated</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => {
              const live = a.guides.filter(
                (g) =>
                  (g.status === "published" || g.status === "scheduled") &&
                  g.published_at &&
                  new Date(g.published_at) <= now,
              ).length;
              return (
                <tr key={a.id}>
                  <td className="min-w-56">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-[12px] text-text-2">
                        {a.avatar_path ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                          <img
                            src={STORAGE + a.avatar_path}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          a.name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/authors/${a.id}`}
                          className="font-medium hover:underline"
                        >
                          {a.name}
                        </Link>
                        <div className="text-admin-meta">/authors/{a.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-text-2">{a.role ?? ""}</td>
                  <td className="text-right num">{formatCount(live)}</td>
                  <td className="text-right text-text-2 num">{formatCount(a.guides.length)}</td>
                  <td className="whitespace-nowrap text-text-2 num">{formatDate(a.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
