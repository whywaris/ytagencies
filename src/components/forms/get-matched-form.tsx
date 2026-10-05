"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import {
  a11yProps,
  Field,
  Honeypot,
  PrivacyNotice,
  selectClasses,
  textareaClasses,
} from "@/components/forms/field";
import { Turnstile } from "@/components/forms/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitGetMatched } from "@/lib/actions/leads";
import { BUDGET_RANGES, getMatchedSchema, type GetMatchedInput } from "@/lib/validation/lead";

type Option = { slug: string; name: string };
type Success = { agencies: { name: string; slug: string }[]; need: string; email: string };

export function GetMatchedForm({
  services,
  industries,
}: {
  services: Option[];
  industries: Option[];
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const successHeading = useRef<HTMLHeadingElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<GetMatchedInput>({
    resolver: zodResolver(getMatchedSchema),
    defaultValues: {
      service: "",
      industry: "",
      budget: "",
      name: "",
      email: "",
      company: "",
      message: "",
      turnstileToken: "",
      website: "",
    },
  });

  useEffect(() => {
    if (success) successHeading.current?.focus();
  }, [success]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitGetMatched(values);
    if (result.ok) {
      setSuccess({ ...result.data, email: values.email });
      return;
    }
    setTurnstileReset((n) => n + 1); // tokens are single-use
    setFormError(result.error);
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as keyof GetMatchedInput, { message });
    }
  });

  if (success) {
    const { agencies, need, email } = success;
    return (
      <div className="flex flex-col gap-4 rounded-lg bg-surface p-6 md:p-8" role="status">
        <h2 ref={successHeading} tabIndex={-1} className="text-h2 outline-none">
          {agencies.length > 0 ? "Your request is on its way" : "We've got your request"}
        </h2>
        {agencies.length > 0 ? (
          <>
            <p>
              We&apos;ve passed your request for {need} to{" "}
              {agencies.length === 1 ? "this agency" : `these ${agencies.length} agencies`}:
            </p>
            <ul className="flex flex-col">
              {agencies.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/agency/${a.slug}`}
                    className="flex min-h-11 items-center text-accent hover:underline"
                  >
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p>
              Each agency will reply to you directly at <strong>{email}</strong>. We&apos;ve emailed
              you a copy of this list. You don&apos;t need to do anything else.
            </p>
          </>
        ) : (
          <p>
            {need ? `No listed agency matches ${need} yet. ` : ""}We&apos;ve saved your request, and
            our team will look for a good fit and email you at <strong>{email}</strong> if we find
            one.
          </p>
        )}
      </div>
    );
  }

  const err = (k: keyof GetMatchedInput) => errors[k]?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-6">
      {formError && (
        <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
          {formError}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="gm-service" label="Service" error={err("service")}>
          <select
            {...register("service")}
            {...a11yProps("gm-service", err("service"))}
            className={selectClasses}
          >
            <option value="">Choose a service</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="gm-industry" label="Your industry" error={err("industry")}>
          <select
            {...register("industry")}
            {...a11yProps("gm-industry", err("industry"))}
            className={selectClasses}
          >
            <option value="">Choose an industry</option>
            {industries.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="gm-budget" label="Monthly budget" error={err("budget")}>
        <select
          {...register("budget")}
          {...a11yProps("gm-budget", err("budget"))}
          className={selectClasses}
        >
          <option value="">Choose a range</option>
          {BUDGET_RANGES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="gm-name" label="Your name" error={err("name")}>
          <Input {...register("name")} {...a11yProps("gm-name", err("name"))} autoComplete="name" />
        </Field>
        <Field id="gm-email" label="Work email" error={err("email")}>
          <Input
            type="email"
            {...register("email")}
            {...a11yProps("gm-email", err("email"))}
            autoComplete="email"
          />
        </Field>
      </div>

      <Field id="gm-company" label="Company" optional error={err("company")}>
        <Input
          {...register("company")}
          {...a11yProps("gm-company", err("company"))}
          autoComplete="organization"
        />
      </Field>

      <Field id="gm-message" label="What do you need help with?" optional error={err("message")}>
        <textarea
          {...register("message")}
          {...a11yProps("gm-message", err("message"))}
          rows={5}
          placeholder="Goals, timeline, links to your channel…"
          className={textareaClasses}
        />
      </Field>

      <Honeypot {...register("website")} />

      <div className="flex flex-col gap-2">
        <Turnstile
          resetKey={turnstileReset}
          onToken={(token) => setValue("turnstileToken", token, { shouldValidate: isSubmitted })}
        />
        {err("turnstileToken") && (
          <p className="text-[14px] text-destructive">{err("turnstileToken")}</p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Sending…" : "Send my request"}
        </Button>
        <PrivacyNotice sharedWith="the agencies we match you with (up to 3)" />
      </div>
    </form>
  );
}
