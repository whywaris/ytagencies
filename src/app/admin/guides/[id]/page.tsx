import { notFound } from "next/navigation";

import { GuideEditor } from "@/components/admin/guide-editor";
import { requireAdmin } from "@/lib/auth";
import {
  authorOptions,
  categoryOptions,
  comboOptions,
  serviceOptions,
  toEditorGuide,
} from "@/lib/data/admin-guides";
import { SITE_DOMAIN } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Edit guide" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditGuidePage({ params }: PageProps<"/admin/guides/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/guides/${id}`);
  if (!UUID.test(id)) notFound();
  const [{ data: guide }, options, authors, categories, services] = await Promise.all([
    createAdminClient().from("guides").select("*").eq("id", id).maybeSingle(),
    comboOptions(),
    authorOptions(),
    categoryOptions(),
    serviceOptions(),
  ]);
  if (!guide) notFound();
  return (
    // Keyed so a different guide (or a refresh after publishing, updating or discarding) starts
    // from the saved state.
    <GuideEditor
      key={`${guide.id}:${guide.status}:${guide.slug}:${guide.updated_at}`}
      guide={toEditorGuide(guide)}
      comboOptions={options}
      authors={authors}
      categories={categories}
      siteHost={SITE_DOMAIN}
      services={services}
    />
  );
}
