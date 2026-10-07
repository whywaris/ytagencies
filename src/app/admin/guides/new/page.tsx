import { GuideEditor } from "@/components/admin/guide-editor";
import { requireAdmin } from "@/lib/auth";
import { authorOptions, comboOptions, NEW_GUIDE } from "@/lib/data/admin-guides";
import { mediaHosts } from "@/lib/media";
import { SITE_DOMAIN } from "@/lib/site";

export const metadata = { title: "New guide" };

export default async function NewGuidePage() {
  await requireAdmin("/admin/guides/new");
  const [options, authors] = await Promise.all([comboOptions(), authorOptions()]);
  return (
    <GuideEditor
      guide={{ ...NEW_GUIDE, authorId: authors[0]?.id ?? null }}
      comboOptions={options}
      authors={authors}
      mediaHosts={mediaHosts()}
      siteHost={SITE_DOMAIN}
    />
  );
}
