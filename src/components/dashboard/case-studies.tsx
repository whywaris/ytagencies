"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { a11yProps, Field, selectClasses, textareaClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormResult } from "@/lib/validation/lead";
import { caseStudySchema, type CaseStudyInput } from "@/lib/validation/dashboard";

type Option = { slug: string; name: string };

const EMPTY: CaseStudyInput = {
  title: "",
  industry: "",
  service: "",
  channelUrl: "",
  summary: "",
  metrics: [],
};

/** Server actions, so the owner dashboard and admin can share this editor with their own checks. */
export type CaseStudyActions = {
  save: (agencyId: string, raw: unknown) => Promise<FormResult<{ id: string }>>;
  remove: (agencyId: string, caseStudyId: string) => Promise<FormResult>;
};

export function CaseStudies({
  agencyId,
  items,
  industries,
  services,
  actions,
}: {
  agencyId: string;
  items: CaseStudyInput[];
  industries: Option[];
  services: Option[];
  actions: CaseStudyActions;
}) {
  const router = useRouter();
  // null = closed, "new" = adding, otherwise the id being edited
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    startTransition(async () => {
      const res = await actions.remove(agencyId, id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {items.length === 0 && editing !== "new" && (
        <p className="text-text-2">
          No case studies yet. Agencies with case studies that show real numbers get more inquiries.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {items.map((item) =>
          editing === item.id ? (
            <li key={item.id}>
              <CaseStudyForm
                save={actions.save}
                agencyId={agencyId}
                industries={industries}
                services={services}
                initial={item}
                onDone={done}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line px-5 py-4"
            >
              <div className="flex flex-col">
                <span className="font-medium">{item.title}</span>
                <span className="text-small">
                  {item.metrics.length} {item.metrics.length === 1 ? "result" : "results"}
                </span>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  className="min-h-11 text-accent hover:underline"
                  onClick={() => setEditing(item.id!)}
                >
                  Edit<span className="sr-only"> {item.title}</span>
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="min-h-11 text-destructive hover:underline"
                  onClick={() => remove(item.id!, item.title)}
                >
                  Delete<span className="sr-only"> {item.title}</span>
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <CaseStudyForm
          save={actions.save}
          agencyId={agencyId}
          industries={industries}
          services={services}
          initial={EMPTY}
          onDone={done}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <Button
          type="button"
          variant="link"
          className="self-start"
          onClick={() => setEditing("new")}
        >
          Add a case study
        </Button>
      )}
    </div>
  );
}

function CaseStudyForm({
  agencyId,
  industries,
  services,
  initial,
  save,
  onDone,
  onCancel,
}: {
  agencyId: string;
  save: CaseStudyActions["save"];
  industries: Option[];
  services: Option[];
  initial: CaseStudyInput;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const prefix = initial.id ? `cs-${initial.id.slice(0, 8)}` : "cs-new";
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CaseStudyInput>({ resolver: zodResolver(caseStudySchema), defaultValues: initial });
  const { fields, append, remove } = useFieldArray({ control, name: "metrics" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await save(agencyId, values);
    if (res.ok) return onDone();
    setFormError(res.error);
    for (const [k, m] of Object.entries(res.fieldErrors ?? {}))
      setError(k as keyof CaseStudyInput, { message: m });
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6 rounded-lg border border-line p-5 md:p-6"
    >
      {formError && (
        <p role="alert" className="text-destructive">
          {formError}
        </p>
      )}
      <Field id={`${prefix}-title`} label="Title" error={errors.title?.message}>
        <Input
          placeholder="Booked consultations for a dental group"
          {...register("title")}
          {...a11yProps(`${prefix}-title`, errors.title?.message)}
        />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id={`${prefix}-industry`} label="Client industry" optional>
          <select {...register("industry")} id={`${prefix}-industry`} className={selectClasses}>
            <option value="">Not set</option>
            {industries.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${prefix}-service`} label="Service" optional>
          <select {...register("service")} id={`${prefix}-service`} className={selectClasses}>
            <option value="">Not set</option>
            {services.map((sv) => (
              <option key={sv.slug} value={sv.slug}>
                {sv.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id={`${prefix}-channel`}
          label="Channel link"
          optional
          error={errors.channelUrl?.message}
        >
          <Input
            type="url"
            placeholder="https://www.youtube.com/@client"
            {...register("channelUrl")}
            {...a11yProps(`${prefix}-channel`, errors.channelUrl?.message)}
          />
        </Field>
      </div>
      <Field id={`${prefix}-summary`} label="What you did" optional error={errors.summary?.message}>
        <textarea
          rows={3}
          {...register("summary")}
          {...a11yProps(`${prefix}-summary`, errors.summary?.message)}
          className={textareaClasses}
        />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[14px] font-medium">Results</legend>
        <p className="-mt-1 text-small">
          Up to 3 headline figures, like &ldquo;+340%&rdquo; for organic views.
        </p>
        {fields.map((field, i) => {
          const e = errors.metrics?.[i];
          return (
            <div
              key={field.id}
              className="grid grid-cols-[7rem_1fr] gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-start"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor={`${prefix}-m${i}-value`} className="sr-only">
                  Result {i + 1} figure
                </label>
                <Input
                  id={`${prefix}-m${i}-value`}
                  placeholder="+340%"
                  maxLength={12}
                  {...register(`metrics.${i}.value`)}
                  aria-invalid={e?.value ? true : undefined}
                />
                {e?.value && <p className="text-[14px] text-destructive">{e.value.message}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${prefix}-m${i}-label`} className="sr-only">
                  Result {i + 1} label
                </label>
                <Input
                  id={`${prefix}-m${i}-label`}
                  placeholder="Organic views"
                  maxLength={40}
                  {...register(`metrics.${i}.label`)}
                  aria-invalid={e?.label ? true : undefined}
                />
                {e?.label && <p className="text-[14px] text-destructive">{e.label.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="col-span-2 min-h-11 justify-self-start text-destructive hover:underline sm:col-span-1"
              >
                Remove<span className="sr-only"> result {i + 1}</span>
              </button>
            </div>
          );
        })}
        {fields.length < 3 && (
          <Button
            type="button"
            variant="link"
            className="self-start"
            onClick={() => append({ value: "", label: "" })}
          >
            Add a result
          </Button>
        )}
        {errors.metrics?.message && (
          <p className="text-[14px] text-destructive">{errors.metrics.message}</p>
        )}
      </fieldset>

      <div className="flex items-center gap-6">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save case study"}
        </Button>
        <Button type="button" variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
