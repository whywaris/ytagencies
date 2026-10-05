"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { textareaClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { saveIntro } from "@/lib/actions/admin";
import { introSchema, type IntroInput } from "@/lib/validation/admin";

export function IntroForm({
  kind,
  id,
  name,
  intro,
}: {
  kind: "services" | "industries";
  id: number;
  name: string;
  intro: string;
}) {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const fieldId = `${kind}-${id}-intro`;
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<IntroInput>({ resolver: zodResolver(introSchema), defaultValues: { intro } });
  const words = (useWatch({ control, name: "intro" }) ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const onSubmit = handleSubmit(async (values) => {
    const res = await saveIntro(kind, id, values);
    setStatus(res.ok ? { ok: true, message: "Saved." } : { ok: false, message: res.error });
    if (res.ok) reset(values);
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-2 rounded-lg border border-line p-4"
    >
      <label htmlFor={fieldId} className="font-medium">
        {name}
      </label>
      <textarea id={fieldId} rows={4} {...register("intro")} className={textareaClasses} />
      {errors.intro && <p className="text-[14px] text-destructive">{errors.intro.message}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="link" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save"}
          <span className="sr-only"> {name} intro</span>
        </Button>
        <span className="text-small">{words} words</span>
        {status && (
          <span
            role={status.ok ? "status" : "alert"}
            className={status.ok ? "text-small" : "text-[14px] text-destructive"}
          >
            {status.message}
          </span>
        )}
      </div>
    </form>
  );
}
