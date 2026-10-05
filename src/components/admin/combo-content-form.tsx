"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { a11yProps, Field, textareaClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveComboContent } from "@/lib/actions/admin";
import { comboContentSchema, type ComboContentInput } from "@/lib/validation/admin";

export function ComboContentForm({
  serviceId,
  industryId,
  defaults,
}: {
  serviceId: number;
  industryId: number;
  defaults: ComboContentInput;
}) {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ComboContentInput>({
    resolver: zodResolver(comboContentSchema),
    defaultValues: defaults,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "faqs" });

  const onSubmit = handleSubmit(async (values) => {
    setStatus(null);
    const res = await saveComboContent(serviceId, industryId, values);
    if (res.ok) return setStatus({ ok: true, message: "Saved. The public page is updated." });
    setStatus({ ok: false, message: res.error });
    for (const [k, m] of Object.entries(res.fieldErrors ?? {}))
      setError(k as keyof ComboContentInput, { message: m });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <Field
        id="c-intro"
        label="Intro (120–200 words, unique to this page)"
        optional
        error={errors.intro?.message}
      >
        <textarea
          rows={8}
          {...register("intro")}
          {...a11yProps("c-intro", errors.intro?.message)}
          className={textareaClasses}
        />
      </Field>
      <Field id="c-how" label="How to choose" optional error={errors.howToChoose?.message}>
        <textarea
          rows={8}
          {...register("howToChoose")}
          {...a11yProps("c-how", errors.howToChoose?.message)}
          className={textareaClasses}
        />
      </Field>
      <p className="-mt-6 text-small">Separate paragraphs with a blank line.</p>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-medium">FAQs (3–5 recommended)</legend>
        {fields.map((f, i) => {
          const e = errors.faqs?.[i];
          return (
            <div key={f.id} className="flex flex-col gap-3 rounded-lg border border-line p-4">
              <Field id={`c-faq-${i}-q`} label={`Question ${i + 1}`} error={e?.question?.message}>
                <Input
                  {...register(`faqs.${i}.question`)}
                  {...a11yProps(`c-faq-${i}-q`, e?.question?.message)}
                />
              </Field>
              <Field id={`c-faq-${i}-a`} label="Answer" error={e?.answer?.message}>
                <textarea
                  rows={3}
                  {...register(`faqs.${i}.answer`)}
                  {...a11yProps(`c-faq-${i}-a`, e?.answer?.message)}
                  className={textareaClasses}
                />
              </Field>
              <button
                type="button"
                onClick={() => remove(i)}
                className="min-h-11 self-start text-destructive hover:underline"
              >
                Remove question {i + 1}
              </button>
            </div>
          );
        })}
        {fields.length < 8 && (
          <Button
            type="button"
            variant="link"
            className="self-start"
            onClick={() => append({ question: "", answer: "" })}
          >
            Add a question
          </Button>
        )}
        {errors.faqs?.message && (
          <p className="text-[14px] text-destructive">{errors.faqs.message}</p>
        )}
      </fieldset>

      <div className="flex flex-col gap-3">
        {status && (
          <p
            role={status.ok ? "status" : "alert"}
            className={status.ok ? "text-text" : "text-destructive"}
          >
            {status.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Saving…" : "Save page copy"}
        </Button>
      </div>
    </form>
  );
}
