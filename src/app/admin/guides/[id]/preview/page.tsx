import Link from "next/link";
import { notFound } from "next/navigation";

import { GuideBody } from "@/components/guide-body";
import { BudgetRange } from "@/components/guides/budget-range";
import { requireAdmin } from "@/lib/auth";
import { resolveCombos } from "@/lib/data/guides";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Guide preview" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Preview as page": the guide as it will read, drafts included. Admin only, never indexed. */
export default async function GuidePreviewPage({
  params,
}: PageProps<"/admin/guides/[id]/preview">) {
  const { id } = await params;
  await requireAdmin(`/admin/guides/${id}/preview`);
  if (!UUID.test(id)) notFound();
  const { data: g } = await createAdminClient()
    .from("guides")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!g) notFound();
  const related = await resolveCombos(g.related_combos);

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-lg border border-line px-4 py-3 text-text-2">
        Preview of the saved version. {g.status === "draft" ? "Not live yet." : null}{" "}
        <Link href={`/admin/guides/${g.id}`} className="text-accent hover:underline">
          Back to the editor
        </Link>
      </p>
      <article className="mx-auto flex w-full max-w-reading flex-col text-[17px] leading-relaxed">
        <h1 className="mb-4 text-h1">{g.title}</h1>
        <p className="mb-10 text-small">{g.author_name || "YT Agencies editorial team"}</p>
        <GuideBody md={g.body_md} budgetRange={(service) => <BudgetRange service={service} />} />
        {related.length > 0 && (
          <aside className="mt-12 flex flex-col gap-3 border-t border-line pt-8">
            <h2 className="text-h3">Find an agency</h2>
            <ul>
              {related.map((r) => (
                <li key={r.href} className="flex min-h-11 items-center text-accent">
                  {r.label}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </article>
    </div>
  );
}
