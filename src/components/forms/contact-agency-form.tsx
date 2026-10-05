"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { contactAgency } from "@/lib/actions/leads";
import { BUDGET_RANGES, contactAgencySchema, type ContactAgencyInput } from "@/lib/validation/lead";

export function ContactAgencyForm({
  agencySlug,
  agencyName,
}: {
  agencySlug: string;
  agencyName: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const successHeading = useRef<HTMLHeadingElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<ContactAgencyInput>({
    resolver: zodResolver(contactAgencySchema),
    defaultValues: {
      agencySlug,
      name: "",
      email: "",
      company: "",
      budget: "",
      message: "",
      turnstileToken: "",
      website: "",
    },
  });

  useEffect(() => {
    if (sentTo) successHeading.current?.focus();
  }, [sentTo]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await contactAgency(values);
    if (result.ok) {
      setSentTo(values.email);
      return;
    }
    setTurnstileReset((n) => n + 1);
    setFormError(result.error);
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as keyof ContactAgencyInput, { message });
    }
  });

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4 rounded-lg bg-surface p-6" role="status">
        <h3 ref={successHeading} tabIndex={-1} className="text-h3 outline-none">
          Message sent to {agencyName}
        </h3>
        <p>
          {agencyName} will reply to you directly at <strong>{sentTo}</strong>. We&apos;ve emailed
          you a copy of your message. You don&apos;t need to do anything else.
        </p>
      </div>
    );
  }

  const err = (k: keyof ContactAgencyInput) => errors[k]?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-6">
      {formError && (
        <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
          {formError}
        </p>
      )}
      <input type="hidden" {...register("agencySlug")} />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="ca-name" label="Your name" error={err("name")}>
          <Input {...register("name")} {...a11yProps("ca-name", err("name"))} autoComplete="name" />
        </Field>
        <Field id="ca-email" label="Work email" error={err("email")}>
          <Input
            type="email"
            {...register("email")}
            {...a11yProps("ca-email", err("email"))}
            autoComplete="email"
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="ca-company" label="Company" optional error={err("company")}>
          <Input
            {...register("company")}
            {...a11yProps("ca-company", err("company"))}
            autoComplete="organization"
          />
        </Field>
        <Field id="ca-budget" label="Monthly budget" optional error={err("budget")}>
          <select
            {...register("budget")}
            {...a11yProps("ca-budget", err("budget"))}
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
      </div>

      <Field id="ca-message" label="Message" error={err("message")}>
        <textarea
          {...register("message")}
          {...a11yProps("ca-message", err("message"))}
          rows={5}
          placeholder="What you need, your goals and timeline"
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
          {isSubmitting ? "Sending…" : "Send inquiry"}
        </Button>
        <PrivacyNotice sharedWith={agencyName} />
      </div>
    </form>
  );
}
