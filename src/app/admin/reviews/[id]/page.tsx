import Link from "next/link";
import { notFound } from "next/navigation";

import { ReviewForm } from "@/components/admin/review-form";
import { reviewFormOptions } from "@/lib/admin-review-options";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEAM_SIZES } from "@/lib/validation/admin";
import {
  REVIEW_BUDGETS,
  REVIEW_STATUSES,
  SCORE_STEPS,
  type ReviewInput,
} from "@/lib/validation/review";

export const metadata = { title: "Edit review" };

const oneOf = <T extends string>(list: readonly T[], v: string | null): T | "" =>
  (list as readonly string[]).includes(v ?? "") ? (v as T) : "";
const score = (v: number | null) => oneOf(SCORE_STEPS, v === null ? null : String(Number(v)));

export default async function EditReviewPage({ params }: PageProps<"/admin/reviews/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/reviews/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: r }, options] = await Promise.all([
    createAdminClient()
      .from("reviews")
      .select("*, services:service_id(slug), reviewer_industry:reviewer_industry_id(slug)")
      .eq("id", id)
      .maybeSingle(),
    reviewFormOptions(),
  ]);
  if (!r) notFound();

  const defaults: ReviewInput = {
    agencyId: r.agency_id,
    status: oneOf(REVIEW_STATUSES, r.status) || "pending",
    authorName: r.author_name,
    authorCompany: r.author_company ?? "",
    reviewerTitle: r.reviewer_title ?? "",
    reviewerIndustry: r.reviewer_industry?.slug ?? "",
    reviewerCompanySize: oneOf(TEAM_SIZES, r.reviewer_company_size),
    reviewerCountry: r.reviewer_country ?? "",
    service: r.services?.slug ?? "",
    budgetRange: oneOf(
      REVIEW_BUDGETS.map((b) => b.value),
      r.budget_range,
    ),
    projectStart: r.project_start ?? "",
    projectEnd: r.project_end ?? "",
    scoreQuality: score(r.score_quality),
    scoreSchedule: score(r.score_schedule),
    scoreCost: score(r.score_cost),
    scoreRefer: score(r.score_refer),
    rating: oneOf(["1", "2", "3", "4", "5"], String(r.rating)),
    body: r.body,
    leadId: r.lead_id ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/reviews" className="self-start text-text-2 hover:text-text">
          ← Reviews
        </Link>
        <h1 className="text-admin-title">Edit review</h1>
        {r.verified_client && <p className="text-success">Verified client (linked to a lead)</p>}
      </div>
      <ReviewForm id={r.id} {...options} defaults={defaults} />
    </div>
  );
}
