import { GuideEditor } from "@/components/admin/guide-editor";
import { requireAdmin } from "@/lib/auth";
import { authorOptions, categoryOptions, NEW_GUIDE } from "@/lib/data/admin-guides";
import { SITE_DOMAIN } from "@/lib/site";

export const metadata = { title: "New guide" };

export default async function NewGuidePage() {
  await requireAdmin("/admin/guides/new");
  const [authors, categories] = await Promise.all([authorOptions(), categoryOptions()]);
  return (
    <GuideEditor
      guide={{ ...NEW_GUIDE, authorId: authors[0]?.id ?? null }}
      authors={authors}
      categories={categories}
      siteHost={SITE_DOMAIN}
    />
  );
}
