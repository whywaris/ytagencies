import Link from "next/link";
import { notFound } from "next/navigation";

import { BudgetRange } from "@/components/guides/budget-range";
import { GuideArticle } from "@/components/guides/guide-article";
import { requireAdmin } from "@/lib/auth";
import { AUTHOR_COLUMNS, resolveCombos, toAuthor, type AuthorRow } from "@/lib/data/guides";
import { docReadMinutes, guideDoc } from "@/lib/guide-content";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Guide preview" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Preview as page": the guide in the public layout, drafts included. Admin only, never indexed. */
export default async function GuidePreviewPage({
  params,
}: PageProps<"/admin/guides/[id]/preview">) {
  const { id } = await params;
  await requireAdmin(`/admin/guides/${id}/preview`);
  if (!UUID.test(id)) notFound();
  const { data: g } = await createAdminClient()
    .from("guides")
    .select(`*, author:authors(${AUTHOR_COLUMNS})`)
    .eq("id", id)
    .maybeSingle();
  if (!g) notFound();
  const related = await resolveCombos(g.related_combos);
  // Unpublished changes if there are any, else the live content.
  const previewDoc = guideDoc(g.draft_json ?? g.body_json, g.body_md);

  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-lg border border-line px-4 py-3 text-text-2">
        Preview of the saved version{g.draft_json ? ", with unpublished changes" : ""}. {g.status === "published" ? null : "Not live yet. "}
        <Link href={`/admin/guides/${g.id}`} className="text-accent hover:underline">
          Back to the editor
        </Link>
      </p>
      <GuideArticle
        guide={{
          slug: g.slug,
          title: g.title,
          doc: previewDoc,
          coverPath: g.cover_path,
          updatedAt: g.draft_updated_at ?? g.content_updated_at ?? g.updated_at,
          readMinutes: docReadMinutes(previewDoc),
          author: toAuthor(g.author as AuthorRow | null),
          keyTakeaways: g.key_takeaways,
          numberedSections: g.numbered_sections,
        }}
        primaryService={related[0]?.service ?? null}
        related={related}
        relatedGuides={[]}
        shareUrl={absoluteUrl(`/guides/${g.slug}`)}
        budgetRange={(service) => <BudgetRange service={service} />}
        // The generated cover image only exists for live guides; drafts get the same look in HTML.
        generatedCover={false}
      />
    </div>
  );
}
