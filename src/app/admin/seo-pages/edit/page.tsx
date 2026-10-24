import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContentForm } from "@/components/admin/page-content-form";
import { requireAdmin } from "@/lib/auth";
import { getDirectoryIndex } from "@/lib/data/agencies";
import { pageTypeOf } from "@/lib/sitemap-core";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Write intro" };

// Admin → SEO pages → Write intro for one page (any type but service × industry, which has its
// own editor under Taxonomy).
export default async function EditPageContentPage({
  searchParams,
}: PageProps<"/admin/seo-pages/edit">) {
  const raw = (await searchParams).path;
  const path = typeof raw === "string" ? raw : "";
  await requireAdmin(`/admin/seo-pages/edit?path=${encodeURIComponent(path)}`);
  const { paths } = await getDirectoryIndex();
  const type = pageTypeOf(path);
  if (!paths.has(path) || type === "service-industry" || type === "service") notFound();
  const { data } = await createAdminClient()
    .from("page_content")
    .select("summary, intro")
    .eq("path", path)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/seo-pages" className="text-admin-meta hover:underline">
          ← SEO pages
        </Link>
        <h1 className="text-admin-title">Write intro</h1>
        <p className="text-text-2">
          <a href={path} target="_blank" rel="noopener" className="text-accent hover:underline">
            {path}
          </a>{" "}
          · {paths.get(path)!.count} agencies
        </p>
      </div>
      <PageContentForm
        path={path}
        summary={data?.summary ?? ""}
        intro={data?.intro ?? ""}
        dataIntro="the short intro built from this page's agencies (counts, starting prices, pricing)"
      />
    </div>
  );
}
