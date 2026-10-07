import { GuideEditor } from "@/components/admin/guide-editor";
import { requireAdmin } from "@/lib/auth";
import { comboOptions, NEW_GUIDE } from "@/lib/data/admin-guides";
import { SITE_DOMAIN } from "@/lib/site";

export const metadata = { title: "New guide" };

export default async function NewGuidePage() {
  await requireAdmin("/admin/guides/new");
  return (
    <GuideEditor guide={NEW_GUIDE} comboOptions={await comboOptions()} siteHost={SITE_DOMAIN} />
  );
}
