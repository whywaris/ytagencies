"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import {
  a11yProps,
  checkboxRow,
  CheckboxGroup,
  Field,
  Honeypot,
  textareaClasses,
} from "@/components/forms/field";
import { Turnstile } from "@/components/forms/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitAgency } from "@/lib/actions/listing";
import { submitAgencySchema, type SubmitAgencyInput } from "@/lib/validation/listing";

type Option = { slug: string; name: string };
type Country = Option & { cities: Option[] };
type Done = { kind: "verify" | "review"; workEmail: string; agencyName: string };

export function SubmitAgencyForm({
  services,
  industries,
  countries,
}: {
  services: Option[];
  industries: Option[];
  countries: Country[];
}) {
  const [done, setDone] = useState<Done | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<SubmitAgencyInput>({
    resolver: zodResolver(submitAgencySchema),
    defaultValues: {
      name: "",
      siteUrl: "",
      services: [],
      industries: [],
      locations: [],
      minBudget: "",
      description: "",
      workEmail: "",
      turnstileToken: "",
      website: "",
    },
  });

  useEffect(() => {
    if (done) doneHeading.current?.focus();
  }, [done]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await submitAgency(values);
    if (res.ok) return setDone(res.data);
    setTurnstileReset((n) => n + 1); // tokens are single-use
    setFormError(res.error);
    for (const [k, m] of Object.entries(res.fieldErrors ?? {})) {
      setError(k as keyof SubmitAgencyInput, { message: m });
    }
  });

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-lg bg-surface p-6 md:p-8">
        <h2 ref={doneHeading} tabIndex={-1} className="text-h2 outline-none">
          Thanks, we&apos;ve got {done.agencyName || "your agency"}
        </h2>
        <p>
          We review every new agency before it goes live, usually within a few business days, and
          we&apos;ll email you when it&apos;s published.
        </p>
        <p>
          {done.kind === "verify"
            ? `To manage the listing, open the confirmation link we sent to ${done.workEmail} while signed in to this account. It expires in 24 hours.`
            : "We'll confirm that you manage this agency during the review."}
        </p>
        <Link href="/dashboard" className="flex min-h-11 items-center text-accent hover:underline">
          Go to your dashboard
        </Link>
      </div>
    );
  }

  const err = (k: keyof SubmitAgencyInput) => errors[k]?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-8">
      {formError && (
        <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
          {formError}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="sa-name" label="Agency name" error={err("name")}>
          <Input
            {...register("name")}
            {...a11yProps("sa-name", err("name"))}
            autoComplete="organization"
          />
        </Field>
        <Field id="sa-site" label="Website" error={err("siteUrl")}>
          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            {...register("siteUrl")}
            {...a11yProps("sa-site", err("siteUrl"))}
            autoComplete="url"
          />
        </Field>
      </div>

      <Field id="sa-description" label="Short description" error={err("description")}>
        <textarea
          {...register("description")}
          {...a11yProps("sa-description", err("description"))}
          rows={4}
          placeholder="What you do, for whom, and what makes you good at it."
          className={textareaClasses}
        />
      </Field>

      <div className="grid gap-8 md:grid-cols-2">
        <CheckboxGroup legend="Services you offer" error={err("services")}>
          {services.map((s) => (
            <label key={s.slug} className={checkboxRow}>
              <input type="checkbox" value={s.slug} {...register("services")} />
              {s.name}
            </label>
          ))}
        </CheckboxGroup>
        <CheckboxGroup legend="Industries you work with" error={err("industries")}>
          <div className="grid gap-x-4 sm:grid-cols-2 md:grid-cols-1">
            {industries.map((i) => (
              <label key={i.slug} className={checkboxRow}>
                <input type="checkbox" value={i.slug} {...register("industries")} />
                {i.name}
              </label>
            ))}
          </div>
        </CheckboxGroup>
      </div>

      <CheckboxGroup legend="Where you're based or work (optional)" error={err("locations")}>
        <div className="grid gap-6 sm:grid-cols-2">
          {countries.map((c) => (
            <div key={c.slug} className="flex flex-col">
              <label className={`${checkboxRow} font-medium`}>
                <input type="checkbox" value={c.slug} {...register("locations")} />
                {c.name}
              </label>
              {c.cities.map((city) => (
                <label key={city.slug} className={`${checkboxRow} pl-8`}>
                  <input type="checkbox" value={city.slug} {...register("locations")} />
                  {city.name}
                </label>
              ))}
            </div>
          ))}
        </div>
      </CheckboxGroup>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id="sa-budget"
          label="Minimum monthly budget (US$)"
          optional
          error={err("minBudget")}
        >
          <Input
            inputMode="numeric"
            {...register("minBudget")}
            {...a11yProps("sa-budget", err("minBudget"))}
          />
        </Field>
        <Field id="sa-email" label="Your work email" error={err("workEmail")}>
          <Input
            type="email"
            {...register("workEmail")}
            {...a11yProps("sa-email", err("workEmail"))}
            autoComplete="email"
          />
        </Field>
      </div>
      <p className="-mt-4 text-small">
        Use an email on your agency&apos;s website domain and we&apos;ll send a link that confirms
        you manage it. Other addresses are checked by hand.
      </p>

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
        {isSubmitting ? "Sending…" : "Submit for review"}
      </Button>
    </form>
  );
}
