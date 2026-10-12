"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { saveReview } from "@/lib/actions/admin-reviews";
import { cn } from "@/lib/utils";
import { TEAM_SIZES } from "@/lib/validation/admin";
import {
  overallOf,
  REVIEW_BUDGETS,
  REVIEW_STATUSES,
  reviewSchema,
  SCORE_KEYS,
  SCORE_LABEL,
  SCORE_STEPS,
  type ReviewInput,
} from "@/lib/validation/review";

type Option = { value: string; label: string };

const input = "h-9 w-full rounded-lg border border-line bg-bg px-3";
const label = "flex flex-col gap-1.5";
const STATUS_LABEL = { pending: "Pending", published: "Published", rejected: "Rejected" };

/** Admin → Reviews → New / Edit. */
export function ReviewForm({
  id,
  defaults,
  agencies,
  services,
  industries,
}: {
  id: string | null;
  defaults: ReviewInput;
  agencies: Option[];
  services: Option[];
  industries: Option[];
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReviewInput>({ resolver: zodResolver(reviewSchema), defaultValues: defaults });
  const scores = useWatch({ control, name: [...SCORE_KEYS] });
  const overall = overallOf(
    Object.fromEntries(SCORE_KEYS.map((k, i) => [k, scores[i] ?? ""])) as Pick<
      ReviewInput,
      (typeof SCORE_KEYS)[number]
    >,
  );

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await saveReview(id, values);
    if (!res.ok) {
      setFormError(res.error);
      for (const [k, m] of Object.entries(res.fieldErrors ?? {}))
        setError(k as keyof ReviewInput, { message: m });
      return;
    }
    toast.success(id ? "Review saved" : "Review added");
    router.push("/admin/reviews");
    router.refresh();
  });

  const err = (k: keyof ReviewInput) =>
    errors[k]?.message && (
      <span className="text-admin-meta text-destructive">{errors[k]?.message}</span>
    );
  const select = (k: keyof ReviewInput, options: Option[], empty?: string) => (
    <select {...register(k)} className={input} aria-invalid={errors[k] ? true : undefined}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-[760px] flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          <span className="font-medium">Agency</span>
          {select("agencyId", agencies, "Choose an agency")}
          {err("agencyId")}
        </label>
        <label className={label}>
          <span className="font-medium">Status</span>
          {select(
            "status",
            REVIEW_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
          )}
        </label>
      </section>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-admin-section">Reviewer</legend>
        <label className={label}>
          <span className="font-medium">Name</span>
          <input {...register("authorName")} className={input} />
          {err("authorName")}
        </label>
        <label className={label}>
          <span className="font-medium">Title</span>
          <input {...register("reviewerTitle")} placeholder="Head of marketing" className={input} />
        </label>
        <label className={label}>
          <span className="font-medium">Company</span>
          <input {...register("authorCompany")} className={input} />
        </label>
        <label className={label}>
          <span className="font-medium">Company size</span>
          {select(
            "reviewerCompanySize",
            TEAM_SIZES.map((t) => ({ value: t, label: `${t} people` })),
            "Not given",
          )}
        </label>
        <label className={label}>
          <span className="font-medium">Industry</span>
          {select("reviewerIndustry", industries, "Not given")}
        </label>
        <label className={label}>
          <span className="font-medium">Country</span>
          <input {...register("reviewerCountry")} className={input} />
        </label>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-admin-section">Project</legend>
        <label className={label}>
          <span className="font-medium">Service</span>
          {select("service", services, "Not given")}
        </label>
        <label className={label}>
          <span className="font-medium">Budget</span>
          {select("budgetRange", [...REVIEW_BUDGETS], "Not given")}
        </label>
        <label className={label}>
          <span className="font-medium">Started</span>
          <input type="date" {...register("projectStart")} className={input} />
          {err("projectStart")}
        </label>
        <label className={label}>
          <span className="font-medium">Ended</span>
          <input type="date" {...register("projectEnd")} className={input} />
          <span className="text-admin-meta">Empty while it&apos;s ongoing.</span>
          {err("projectEnd")}
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-admin-section">Scores</legend>
        <div className="grid gap-4 sm:grid-cols-4">
          {SCORE_KEYS.map((k) => (
            <label key={k} className={label}>
              <span className="font-medium">{SCORE_LABEL[k]}</span>
              {select(
                k,
                SCORE_STEPS.map((s) => ({ value: s, label: s })),
                "–",
              )}
            </label>
          ))}
        </div>
        {err("scoreQuality")}
        <p className={cn("text-text-2", overall !== null && "text-text")}>
          {overall !== null ? (
            <>
              Overall <span className="font-medium num">{overall.toFixed(2)}</span>, shown as{" "}
              <span className="num">{Math.round(overall)}</span> stars.
            </>
          ) : (
            "Overall: give all four scores, or a star rating below."
          )}
        </p>
        {overall === null && (
          <label className={cn(label, "sm:w-48")}>
            <span className="font-medium">Star rating</span>
            {select(
              "rating",
              ["5", "4", "3", "2", "1"].map((r) => ({ value: r, label: `${r} out of 5` })),
              "Choose",
            )}
            {err("rating")}
          </label>
        )}
      </fieldset>

      <label className={label}>
        <span className="font-medium">Review</span>
        <textarea
          rows={6}
          {...register("body")}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2"
        />
        {err("body")}
      </label>

      <label className={cn(label, "max-w-[420px]")}>
        <span className="font-medium">Lead ID</span>
        <input {...register("leadId")} placeholder="Optional" className={cn(input, "num")} />
        <span className="text-admin-meta">
          Link the review to the inquiry it came from (Admin → Leads). Linked reviews show
          &ldquo;Verified client&rdquo;.
        </span>
        {err("leadId")}
      </label>

      <div className="flex flex-col gap-3">
        {formError && (
          <p role="alert" className="text-destructive">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-9 self-start rounded-lg bg-accent px-4 font-medium text-on-accent transition-colors duration-150 hover:bg-(--accent-hover) disabled:opacity-60"
        >
          {isSubmitting ? "Saving…" : id ? "Save review" : "Add review"}
        </button>
      </div>
    </form>
  );
}
