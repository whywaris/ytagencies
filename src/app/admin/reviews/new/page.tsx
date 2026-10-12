import Link from "next/link";

import { ReviewForm } from "@/components/admin/review-form";
import { reviewFormOptions } from "@/lib/admin-review-options";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "New review" };

export default async function NewReviewPage({ searchParams }: PageProps<"/admin/reviews/new">) {
  await requireAdmin("/admin/reviews/new");
  const agency = (await searchParams).agency;
  const options = await reviewFormOptions();
  const preset =
    typeof agency === "string" && options.agencies.some((a) => a.value === agency) ? agency : "";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/reviews" className="self-start text-text-2 hover:text-text">
          ← Reviews
        </Link>
        <h1 className="text-admin-title">New review</h1>
        <p className="max-w-reading text-text-2">
          Add only genuine reviews from real clients, in their own words.
        </p>
      </div>
      <ReviewForm
        id={null}
        {...options}
        defaults={{
          agencyId: preset,
          status: "pending",
          authorName: "",
          authorCompany: "",
          reviewerTitle: "",
          reviewerIndustry: "",
          reviewerCompanySize: "",
          reviewerCountry: "",
          service: "",
          budgetRange: "",
          projectStart: "",
          projectEnd: "",
          scoreQuality: "",
          scoreSchedule: "",
          scoreCost: "",
          scoreRefer: "",
          rating: "",
          body: "",
          leadId: "",
        }}
      />
    </div>
  );
}
