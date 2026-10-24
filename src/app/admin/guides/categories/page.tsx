import Link from "next/link";

import { CategoryManager } from "@/components/admin/category-manager";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Guide categories" };

// Admin → Guides → Categories. Counts include drafts (a category with any guide can't be
// deleted) and say how many are live (only categories with live guides show on /guides).
export default async function GuideCategoriesPage() {
  await requireAdmin("/admin/guides/categories");
  const db = createAdminClient();
  const [cats, guides] = await Promise.all([
    db
      .from("guide_categories")
      .select("id, name, slug, description, color, show_in_tabs")
      .order("sort_order")
      .order("name"),
    db.from("guides").select("category_id, status, published_at"),
  ]);
  if (cats.error || guides.error) throw new Error("Couldn't load categories");
  const now = new Date().getTime();
  const count = (id: string, liveOnly: boolean) =>
    guides.data.filter(
      (g) =>
        g.category_id === id &&
        (!liveOnly ||
          ((g.status === "published" || g.status === "scheduled") &&
            !!g.published_at &&
            Date.parse(g.published_at) <= now)),
    ).length;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/guides" className="text-admin-meta hover:underline">
          ← Guides
        </Link>
        <h1 className="text-admin-title">Categories</h1>
        <p className="text-text-2">
          Each guide has one category. /guides shows a tab for each category set as a tab that has a
          live guide, in this order, up to the limit in Settings; the rest go under
          &ldquo;More&rdquo;. Categories without live guides aren&apos;t shown anywhere.
        </p>
      </div>
      <CategoryManager
        categories={cats.data.map((c) => ({
          ...c,
          guides: count(c.id, false),
          live: count(c.id, true),
        }))}
      />
    </div>
  );
}
