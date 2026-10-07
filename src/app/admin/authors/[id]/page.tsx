import { ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";

import { AuthorForm } from "@/components/admin/author-form";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Edit author" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditAuthorPage({ params }: PageProps<"/admin/authors/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/authors/${id}`);
  if (!UUID.test(id)) notFound();
  const { data: a } = await createAdminClient()
    .from("authors")
    .select("*, guides(status, published_at)")
    .eq("id", id)
    .maybeSingle();
  if (!a) notFound();
  const now = new Date();
  const live = a.guides.some(
    (g) =>
      (g.status === "published" || g.status === "scheduled") &&
      g.published_at &&
      new Date(g.published_at) <= now,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-admin-title">{a.name}</h1>
        {live && (
          <a
            href={`/authors/${a.slug}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 hover:underline"
          >
            View live
            <ArrowUpRight className="size-4 [stroke-width:1.5] text-text-2" aria-hidden />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
      <AuthorForm
        // Keyed so a save that changes the slug starts from the saved state.
        key={`${a.id}:${a.updated_at}`}
        author={{
          id: a.id,
          name: a.name,
          slug: a.slug,
          role: a.role ?? "",
          bio: a.bio ?? "",
          linkedinUrl: a.linkedin_url ?? "",
          xUrl: a.x_url ?? "",
          websiteUrl: a.website_url ?? "",
          avatarPath: a.avatar_path,
          live,
        }}
      />
    </div>
  );
}
