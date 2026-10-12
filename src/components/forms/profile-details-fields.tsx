"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useFieldArray, useWatch, type FieldErrors, type UseFormReturn } from "react-hook-form";

import { a11yProps, Field, selectClasses, textareaClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRICING_MODELS } from "@/lib/pricing";
import { PRICING_LABEL } from "@/lib/profile";
import { cn } from "@/lib/utils";
import {
  focusTotal,
  MAX_PROCESS_STEPS,
  REPORTING_FREQUENCIES,
  REPORTING_LABEL,
  type ServiceDetail,
} from "@/lib/validation/profile-details";

type Option = { slug: string; name: string };

/** The part of a form's values these fields read and write (profileDetailsFields). */
export type DetailsForm = {
  services: string[];
  industries: string[];
  bestFor: string;
  timezone: string;
  youtubeChannelUrl: string;
  linkedinUrl: string;
  reportingFrequency: "" | (typeof REPORTING_FREQUENCIES)[number];
  process: { title: string; description: string }[];
  serviceDetails: Record<string, ServiceDetail>;
  industryFocus: Record<string, string>;
};

const message = (e: unknown) =>
  e && typeof e === "object" && "message" in e && typeof e.message === "string"
    ? e.message
    : undefined;

/**
 * Optional profile details, shared by the dashboard and admin profile form and the submission
 * form: best for, time zone, links, reporting, process steps, and per chosen service / industry
 * the focus %, what's included and an optional price. The parent form owns the values.
 */
export function ProfileDetailsFields({
  form,
  idPrefix,
  services,
  industries,
}: {
  // The parent's form, whose values include DetailsForm. RHF's types are invariant in the
  // values type, so callers pass `form as unknown as UseFormReturn<DetailsForm>`.
  form: UseFormReturn<DetailsForm>;
  idPrefix: string;
  services: Option[];
  industries: Option[];
}) {
  const { register, control } = form;
  const errors: FieldErrors<DetailsForm> = form.formState.errors;
  const steps = useFieldArray({ control, name: "process" });
  const chosenServices = useWatch({ control, name: "services" }) ?? [];
  const chosenIndustries = useWatch({ control, name: "industries" }) ?? [];
  const serviceDetails = useWatch({ control, name: "serviceDetails" }) ?? {};
  const industryFocus = useWatch({ control, name: "industryFocus" }) ?? {};
  const id = (k: string) => `${idPrefix}-${k}`;

  const shownServices = services.filter((s) => chosenServices.includes(s.slug));
  const shownIndustries = industries.filter((i) => chosenIndustries.includes(i.slug));
  const serviceTotal = focusTotal(chosenServices, (s) => serviceDetails[s]?.focus);
  const industryTotal = focusTotal(chosenIndustries, (i) => industryFocus[i]);

  return (
    <div className="flex flex-col gap-10">
      <fieldset className="flex flex-col gap-6">
        <legend className="mb-2 text-h3">How you work</legend>
        <Field id={id("best-for")} label="Best for" optional error={errors.bestFor?.message}>
          <Input
            maxLength={120}
            placeholder="Ecommerce and gaming brands with $3k+ monthly budgets"
            {...register("bestFor")}
            {...a11yProps(id("best-for"), errors.bestFor?.message)}
          />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id={id("timezone")} label="Time zone" optional error={errors.timezone?.message}>
            <Input
              maxLength={60}
              placeholder="GMT, works with US hours"
              {...register("timezone")}
              {...a11yProps(id("timezone"), errors.timezone?.message)}
            />
          </Field>
          <Field
            id={id("reporting")}
            label="Reporting"
            optional
            error={errors.reportingFrequency?.message}
          >
            <select
              {...register("reportingFrequency")}
              {...a11yProps(id("reporting"), errors.reportingFrequency?.message)}
              className={selectClasses}
            >
              <option value="">Not set</option>
              {REPORTING_FREQUENCIES.map((r) => (
                <option key={r} value={r}>
                  {REPORTING_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id={id("youtube")}
            label="Your agency's YouTube channel"
            optional
            error={errors.youtubeChannelUrl?.message}
          >
            <Input
              type="url"
              placeholder="https://www.youtube.com/@youragency"
              {...register("youtubeChannelUrl")}
              {...a11yProps(id("youtube"), errors.youtubeChannelUrl?.message)}
            />
          </Field>
          <Field id={id("linkedin")} label="LinkedIn" optional error={errors.linkedinUrl?.message}>
            <Input
              type="url"
              placeholder="https://www.linkedin.com/company/youragency"
              {...register("linkedinUrl")}
              {...a11yProps(id("linkedin"), errors.linkedinUrl?.message)}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-h3">Your process</legend>
        <p className="-mt-2 text-small">
          Up to {MAX_PROCESS_STEPS} steps, in the order a client goes through them.
        </p>
        {steps.fields.length > 0 && (
          <ol className="flex flex-col gap-3">
            {steps.fields.map((step, i) => {
              const e = errors.process?.[i];
              return (
                <li
                  key={step.id}
                  className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[2rem_12rem_1fr_auto] sm:items-start"
                >
                  <span className="text-h3 text-text-2 tabular-nums" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={id(`step-${i}-title`)} className="sr-only">
                      Step {i + 1} name
                    </label>
                    <Input
                      id={id(`step-${i}-title`)}
                      maxLength={40}
                      placeholder="Channel audit"
                      {...register(`process.${i}.title`)}
                      aria-invalid={e?.title ? true : undefined}
                    />
                    {e?.title && <p className="text-[14px] text-destructive">{e.title.message}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={id(`step-${i}-description`)} className="sr-only">
                      Step {i + 1} description
                    </label>
                    <Input
                      id={id(`step-${i}-description`)}
                      maxLength={120}
                      placeholder="We review your last 50 videos and your competitors'."
                      {...register(`process.${i}.description`)}
                      aria-invalid={e?.description ? true : undefined}
                    />
                    {e?.description && (
                      <p className="text-[14px] text-destructive">{e.description.message}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <IconButton
                      label={`Move step ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => steps.move(i, i - 1)}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Move step ${i + 1} down`}
                      disabled={i === steps.fields.length - 1}
                      onClick={() => steps.move(i, i + 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </IconButton>
                    <IconButton label={`Remove step ${i + 1}`} onClick={() => steps.remove(i)}>
                      <X className="size-4" aria-hidden />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {steps.fields.length < MAX_PROCESS_STEPS && (
          <Button
            type="button"
            variant="link"
            className="self-start"
            onClick={() => steps.append({ title: "", description: "" })}
          >
            Add a step
          </Button>
        )}
        {message(errors.process) && (
          <p className="text-[14px] text-destructive">{message(errors.process)}</p>
        )}
      </fieldset>

      {shownServices.length > 0 && (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 text-h3">Per service</legend>
          <p className="-mt-2 text-small">
            Optional. Focus is the share of your work each service takes; once you fill it in, it
            should add up to 100%.
          </p>
          <FocusTotal label="Services" total={serviceTotal} />
          {shownServices.map((s) => {
            const e = errors.serviceDetails?.[s.slug];
            return (
              <div key={s.slug} className="flex flex-col gap-4 rounded-lg border border-line p-4">
                <p className="font-medium">{s.name}</p>
                <div className="grid gap-4 sm:grid-cols-[8rem_10rem_1fr]">
                  <Field id={id(`${s.slug}-focus`)} label="Focus %" error={e?.focus?.message}>
                    <Input
                      inputMode="numeric"
                      placeholder="50"
                      {...register(`serviceDetails.${s.slug}.focus`)}
                      {...a11yProps(id(`${s.slug}-focus`), e?.focus?.message)}
                    />
                  </Field>
                  <Field
                    id={id(`${s.slug}-price`)}
                    label="From (US$)"
                    optional
                    error={e?.price?.message}
                  >
                    <Input
                      inputMode="numeric"
                      {...register(`serviceDetails.${s.slug}.price`)}
                      {...a11yProps(id(`${s.slug}-price`), e?.price?.message)}
                    />
                  </Field>
                  <Field id={id(`${s.slug}-unit`)} label="Per" optional error={e?.unit?.message}>
                    <select
                      {...register(`serviceDetails.${s.slug}.unit`)}
                      {...a11yProps(id(`${s.slug}-unit`), e?.unit?.message)}
                      className={selectClasses}
                    >
                      <option value="">Same as your main price</option>
                      {PRICING_MODELS.map((m) => (
                        <option key={m} value={m}>
                          {PRICING_LABEL[m]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field
                  id={id(`${s.slug}-included`)}
                  label="What's included (one per line, up to 6)"
                  optional
                  error={e?.included?.message}
                >
                  <textarea
                    rows={3}
                    placeholder={"Scripts\nEditing\nThumbnails"}
                    {...register(`serviceDetails.${s.slug}.included`)}
                    {...a11yProps(id(`${s.slug}-included`), e?.included?.message)}
                    className={textareaClasses}
                  />
                </Field>
              </div>
            );
          })}
          {message(errors.serviceDetails) && (
            <p role="alert" className="text-[14px] text-destructive">
              {message(errors.serviceDetails)}
            </p>
          )}
        </fieldset>
      )}

      {shownIndustries.length > 0 && (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 text-h3">Per industry</legend>
          <FocusTotal label="Industries" total={industryTotal} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shownIndustries.map((ind) => {
              const e = errors.industryFocus?.[ind.slug];
              return (
                <Field
                  key={ind.slug}
                  id={id(`${ind.slug}-ifocus`)}
                  label={`${ind.name} focus %`}
                  error={e?.message}
                >
                  <Input
                    inputMode="numeric"
                    {...register(`industryFocus.${ind.slug}`)}
                    {...a11yProps(id(`${ind.slug}-ifocus`), e?.message)}
                  />
                </Field>
              );
            })}
          </div>
          {message(errors.industryFocus) && (
            <p role="alert" className="text-[14px] text-destructive">
              {message(errors.industryFocus)}
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}

/** "Services: 100% ✓" while the percentages add up; the running total otherwise. */
function FocusTotal({ label, total }: { label: string; total: number | null }) {
  if (total === null) return null;
  const ok = total === 100;
  return (
    <p aria-live="polite" className={cn("text-[14px] font-medium", !ok && "text-text-2")}>
      {label}: <span className="tabular-nums">{total}%</span>
      {ok ? " ✓" : " (should add up to 100%)"}
    </p>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full border border-line transition-colors duration-150 hover:border-text-2 disabled:opacity-40 disabled:hover:border-line"
    >
      {children}
    </button>
  );
}
