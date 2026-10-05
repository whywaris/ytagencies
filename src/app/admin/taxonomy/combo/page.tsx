import Link from "next/link";
import { notFound } from "next/navigation";

import { ComboContentForm } from "@/components/admin/combo-content-form";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ComboContentInput } from "@/lib/validation/admin";

export const metadata = { title: "Combination page copy" };

const SLUG = /^[a-z0-9-]{1,80}$/;

export default async function ComboCopyPage({ searchParams }: PageProps<"/admin/taxonomy/combo">) {
  await requireAdmin("/admin/taxonomy");
  const { service: s, industry: i } = await searchParams;
  if (typeof s !== "string" || typeof i !== "string" || !SLUG.test(s) || !SLUG.test(i)) notFound();

  const db = createAdminClient();
  const [{ data: service }, { data: industry }] = await Promise.all([
    db.from("services").select("id, slug, name").eq("slug", s).maybeSingle(),
    db.from("industries").select("id, slug, name, intro").eq("slug", i).maybeSingle(),
  ]);
  if (!service || !industry) notFound();

  const { data: content } = await db
    .from("service_industry_content")
    .select("intro, how_to_choose, faqs")
    .eq("service_id", service.id)
    .eq("industry_id", industry.id)
    .maybeSingle();

  const faqs = Array.isArray(content?.faqs)
    ? content.faqs.flatMap((f) =>
        f &&
        typeof f === "object" &&
        !Array.isArray(f) &&
        typeof f.question === "string" &&
        typeof f.answer === "string"
          ? [{ question: f.question, answer: f.answer }]
          : [],
      )
    : [];
  const defaults: ComboContentInput = {
    intro: content?.intro ?? "",
    howToChoose: content?.how_to_choose ?? "",
    faqs,
  };
  const path = `/${service.slug}/for-${industry.slug}`;

  return (
    <div className="flex max-w-reading flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/admin/taxonomy" className="self-start text-small hover:text-text">
          ← Taxonomy
        </Link>
        <h1 className="text-h2">
          {service.name} for {industry.name}
        </h1>
        <Link href={path} className="self-start text-accent hover:underline">
          View {path}
        </Link>
        {!content && (
          <p className="text-text-2">
            No copy yet. The page currently uses the {industry.name} intro and generic how-to-choose
            text and FAQs.
          </p>
        )}
      </header>
      <ComboContentForm serviceId={service.id} industryId={industry.id} defaults={defaults} />
    </div>
  );
}
