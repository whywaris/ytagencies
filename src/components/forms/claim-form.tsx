"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { a11yProps, Field, Honeypot } from "@/components/forms/field";
import { Turnstile } from "@/components/forms/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startClaim } from "@/lib/actions/claims";
import { claimSchema, type ClaimInput } from "@/lib/validation/auth";

export function ClaimForm({ agencySlug, domain }: { agencySlug: string; domain: string | null }) {
  const [result, setResult] = useState<{ kind: "verify" | "review"; workEmail: string } | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<ClaimInput>({
    resolver: zodResolver(claimSchema),
    defaultValues: { agencySlug, workEmail: "", turnstileToken: "", website: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await startClaim(values);
    if (res.ok) return setResult(res.data);
    setTurnstileReset((n) => n + 1);
    setFormError(res.error);
    for (const [k, m] of Object.entries(res.fieldErrors ?? {})) {
      setError(k as keyof ClaimInput, { message: m });
    }
  });

  if (result) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg bg-surface p-6">
        <p className="text-h3">
          {result.kind === "verify" ? "Check your work email" : "Claim received"}
        </p>
        <p>
          {result.kind === "verify"
            ? `We sent a confirmation link to ${result.workEmail}. Open it while signed in to this account. It expires in 24 hours.`
            : "We'll review this claim by hand and email you when it's decided. This usually takes a few business days."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-6">
      {formError && (
        <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
          {formError}
        </p>
      )}
      <input type="hidden" {...register("agencySlug")} />
      <Field id="claim-email" label="Your work email" error={errors.workEmail?.message}>
        <Input
          type="email"
          autoComplete="email"
          placeholder={domain ? `you@${domain}` : undefined}
          {...register("workEmail")}
          {...a11yProps("claim-email", errors.workEmail?.message)}
        />
      </Field>
      <Honeypot {...register("website")} />
      <div className="flex flex-col gap-2">
        <Turnstile
          resetKey={turnstileReset}
          onToken={(t) => setValue("turnstileToken", t, { shouldValidate: isSubmitted })}
        />
        {errors.turnstileToken && (
          <p className="text-[14px] text-destructive">{errors.turnstileToken.message}</p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Sending…" : "Claim this listing"}
      </Button>
    </form>
  );
}
