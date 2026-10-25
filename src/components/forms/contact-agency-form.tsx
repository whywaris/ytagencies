"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import Link from "next/link";

import {
  a11yProps,
  checkboxRow,
  Field,
  Honeypot,
  selectClasses,
  textareaClasses,
} from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contactAgency } from "@/lib/actions/leads";
import { quoteConsent } from "@/lib/profile-mode";
import {
  BUDGET_RANGES,
  contactAgencySchema,
  GOALS,
  START_TIMELINES,
  type ContactAgencyInput,
} from "@/lib/validation/lead";
import { track } from "@/lib/track";

type Option = { value: string; label: string };

/** "Request a quote from {Agency}": every profile, claimed or not. */
export function ContactAgencyForm({
  agencySlug,
  agencyName,
  services,
  industries,
}: {
  agencySlug: string;
  agencyName: string;
  /** The agency's services, main one first. */
  services: Option[];
  /** The agency's industries first, then the rest. */
  industries: Option[];
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactAgencyInput>({
    resolver: zodResolver(contactAgencySchema),
    defaultValues: {
      agencySlug,
      name: "",
      email: "",
      company: "",
      service: services.length === 1 ? services[0].value : "",
      industry: "",
      goal: undefined,
      budget: undefined,
      start: undefined,
      customerLocation: "",
      message: "",
      consent: false,
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
      track("contact_agency_submit", { agency_slug: agencySlug });
      setSentTo(values.email);
      return;
    }
    setFormError(result.error);
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as keyof ContactAgencyInput, { message });
    }
  });

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4 rounded-lg bg-surface p-6" role="status">
        <h3 ref={successHeading} tabIndex={-1} className="text-h3 outline-none">
          Request sent to {agencyName}
        </h3>
        <p>
          We&apos;ve emailed a copy to <strong>{sentTo}</strong>. If {agencyName} doesn&apos;t reply
          within 48 hours, we&apos;ll send your request to up to 3 similar agencies and tell you who.
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
        <Field id="ca-service" label="Service" error={err("service")}>
          <select
            {...register("service")}
            {...a11yProps("ca-service", err("service"))}
            className={selectClasses}
          >
            <option value="">Choose a service</option>
            {services.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ca-industry" label="Your niche" error={err("industry")}>
          <select
            {...register("industry")}
            {...a11yProps("ca-industry", err("industry"))}
            className={selectClasses}
          >
            <option value="">Choose your niche</option>
            {industries.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="ca-budget" label="Monthly budget" error={err("budget")}>
          <select
            {...register("budget")}
            {...a11yProps("ca-budget", err("budget"))}
            className={selectClasses}
          >
            <option value="">Choose a range</option>
            {BUDGET_RANGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ca-start" label="When do you want to start?" error={err("start")}>
          <select
            {...register("start")}
            {...a11yProps("ca-start", err("start"))}
            className={selectClasses}
          >
            <option value="">Choose a timeline</option>
            {START_TIMELINES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="ca-goal" label="Main goal" error={err("goal")}>
          <select
            {...register("goal")}
            {...a11yProps("ca-goal", err("goal"))}
            className={selectClasses}
          >
            <option value="">Choose a goal</option>
            {GOALS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ca-country" label="Your country" error={err("customerLocation")}>
          <Input
            {...register("customerLocation")}
            {...a11yProps("ca-country", err("customerLocation"))}
            autoComplete="country-name"
          />
        </Field>
      </div>

      <Field id="ca-company" label="Company" optional error={err("company")}>
        <Input
          {...register("company")}
          {...a11yProps("ca-company", err("company"))}
          autoComplete="organization"
        />
      </Field>

      <Field id="ca-message" label="Message" error={err("message")}>
        <textarea
          {...register("message")}
          {...a11yProps("ca-message", err("message"))}
          rows={5}
          placeholder="What you need and what a good result looks like"
          className={textareaClasses}
        />
      </Field>

      <div className="flex flex-col gap-1">
        <label className={checkboxRow}>
          <input
            type="checkbox"
            {...register("consent")}
            aria-invalid={err("consent") ? true : undefined}
            aria-describedby={err("consent") ? "ca-consent-error" : undefined}
          />
          <span className="text-[15px]">{quoteConsent(agencyName)}</span>
        </label>
        {err("consent") && (
          <p id="ca-consent-error" className="text-[14px] text-destructive">
            {err("consent")}
          </p>
        )}
      </div>

      <Honeypot {...register("website")} />

      <div className="flex flex-col gap-4">
        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Sending…" : "Send request"}
        </Button>
        <p className="text-small">
          Your name, email, company and message go only to agencies on a Pro plan that you send
          this request to. Agencies not on Pro see a short preview without them. We don&apos;t sell
          your details or add you to a mailing list. See our{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
