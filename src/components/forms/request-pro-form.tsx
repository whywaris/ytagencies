"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { a11yProps, Field, Honeypot } from "@/components/forms/field";
import { Turnstile } from "@/components/forms/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPro } from "@/lib/actions/pro";
import { proRequestSchema, type ProRequestInput } from "@/lib/validation/pro";

// "Get Pro" while payments are off: opens this form (native <details>, keyboard and no-JS
// friendly), which lands in Admin → Inbox. We grant Pro by hand and reply by email.
export function RequestProForm({
  label = "Get Pro",
  period = "monthly",
  agency = "",
}: {
  label?: string;
  period?: "monthly" | "yearly";
  /** Prefilled on the dashboard: the agency's listing link. */
  agency?: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const done = useRef<HTMLParagraphElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<ProRequestInput>({
    resolver: zodResolver(proRequestSchema),
    defaultValues: { name: "", email: "", agency, period, turnstileToken: "", website: "" },
  });
  // The pricing page's monthly/yearly toggle picks the default.
  useEffect(() => setValue("period", period), [period, setValue]);
  useEffect(() => {
    if (sent) done.current?.focus();
  }, [sent]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await requestPro(values);
    if (result.ok) return setSent(true);
    setTurnstileReset((n) => n + 1);
    setFormError(result.error);
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as keyof ProRequestInput, { message });
    }
  });
  const err = (k: keyof ProRequestInput) => errors[k]?.message;

  return (
    <details className="group flex flex-col">
      <summary className="inline-flex h-11 cursor-pointer list-none items-center justify-center self-start rounded-full bg-accent px-5 font-semibold text-on-accent group-open:hidden [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      {sent ? (
        <p
          ref={done}
          tabIndex={-1}
          role="status"
          className="rounded-lg bg-surface p-4 outline-none"
        >
          Thanks. We&apos;ve got your request and will email you to set up Pro.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-4">
          <p className="text-small">
            Payments aren&apos;t live yet. Tell us who you are and we&apos;ll set up Pro by email.
          </p>
          {formError && (
            <p role="alert" className="rounded-md border border-destructive p-3 text-destructive">
              {formError}
            </p>
          )}
          <Field id="rp-name" label="Your name" error={err("name")}>
            <Input
              {...register("name")}
              {...a11yProps("rp-name", err("name"))}
              autoComplete="name"
            />
          </Field>
          <Field id="rp-email" label="Email" error={err("email")}>
            <Input
              type="email"
              {...register("email")}
              {...a11yProps("rp-email", err("email"))}
              autoComplete="email"
            />
          </Field>
          <Field id="rp-agency" label="Agency name or listing link" error={err("agency")}>
            <Input
              {...register("agency")}
              {...a11yProps("rp-agency", err("agency"))}
              autoComplete="organization"
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">Billing</legend>
            <div className="flex gap-5">
              {(["monthly", "yearly"] as const).map((p) => (
                <label key={p} className="flex min-h-11 items-center gap-2">
                  <input type="radio" value={p} {...register("period")} className="size-4" />
                  {p === "monthly" ? "Monthly" : "Yearly"}
                </label>
              ))}
            </div>
          </fieldset>
          <Honeypot {...register("website")} />
          <div className="flex flex-col gap-2">
            <Turnstile
              resetKey={turnstileReset}
              onToken={(token) =>
                setValue("turnstileToken", token, { shouldValidate: isSubmitted })
              }
            />
            {err("turnstileToken") && (
              <p className="text-[14px] text-destructive">{err("turnstileToken")}</p>
            )}
          </div>
          <Button type="submit" disabled={isSubmitting} className="self-start">
            {isSubmitting ? "Sending…" : "Request Pro"}
          </Button>
        </form>
      )}
    </details>
  );
}
