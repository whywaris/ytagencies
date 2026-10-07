import { notFound } from "next/navigation";

import { GuideEditor } from "@/components/admin/guide-editor";
import { requireAdmin } from "@/lib/auth";
import { comboOptions, toEditorGuide } from "@/lib/data/admin-guides";
import { SITE_DOMAIN } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Edit guide" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditGuidePage({ params }: PageProps<"/admin/guides/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/guides/${id}`);
  if (!UUID.test(id)) notFound();
  const [{ data: guide }, options] = await Promise.all([
    createAdminClient().from("guides").select("*").eq("id", id).maybeSingle(),
    comboOptions(),
  ]);
  if (!guide) notFound();
  return (
    // Keyed so a different guide (or a refresh after publishing) starts from the saved state.
    <GuideEditor
      key={`${guide.id}:${guide.status}:${guide.slug}`}
      guide={toEditorGuide(guide)}
      comboOptions={options}
      siteHost={SITE_DOMAIN}
    />
  );
}
