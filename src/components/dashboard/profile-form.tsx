"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  a11yProps,
  checkboxRow,
  CheckboxGroup,
  Field,
  selectClasses,
  textareaClasses,
} from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRICING_LABEL } from "@/lib/profile";
import { PRICING_MODELS, profileSchema, type ProfileInput } from "@/lib/validation/dashboard";
import type { FormResult } from "@/lib/validation/lead";

type Option = { slug: string; name: string };
type Country = Option & { cities: Option[] };

export function ProfileForm({
  save,
  agencyId,
  defaults,
  services,
  industries,
  countries,
}: {
  /** Server action: the owner's updateProfile, or the admin equivalent. */
  save: (agencyId: string, values: ProfileInput) => Promise<FormResult>;
  agencyId: string;
  defaults: ProfileInput;
  services: Option[];
  industries: Option[];
  countries: Country[];
}) {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues: defaults });

  const chosenServices = useWatch({ control, name: "services" });
  const chosenIndustries = useWatch({ control, name: "industries" });

  const onSubmit = handleSubmit(async (values) => {
    setStatus(null);
    const res = await save(agencyId, values);
    if (res.ok)
      return setStatus({
        ok: true,
        message: "Saved. Your public profile and directory pages are updated.",
      });
    setStatus({ ok: false, message: res.error });
    for (const [k, m] of Object.entries(res.fieldErrors ?? {}))
      setError(k as keyof ProfileInput, { message: m });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <Field id="p-description" label="About your agency" error={errors.description?.message}>
        <textarea
          rows={8}
          {...register("description")}
          {...a11yProps("p-description", errors.description?.message)}
          className={textareaClasses}
        />
      </Field>
      <p className="-mt-6 text-small">
        Aim for 150 words or more: who you work with, what you do, and results you can point to.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id="p-budget"
          label="Minimum budget (US$)"
          optional
          error={errors.minBudget?.message}
        >
          <Input
            inputMode="numeric"
            {...register("minBudget")}
            {...a11yProps("p-budget", errors.minBudget?.message)}
          />
        </Field>
        <Field id="p-pricing" label="Pricing model" optional error={errors.pricingModel?.message}>
          <select
            {...register("pricingModel")}
            {...a11yProps("p-pricing", errors.pricingModel?.message)}
            className={selectClasses}
          >
            <option value="">Not set</option>
            {PRICING_MODELS.map((m) => (
              <option key={m} value={m}>
                {PRICING_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <CheckboxGroup legend="Services you offer" error={errors.services?.message}>
          <div className="grid gap-x-4 sm:grid-cols-2 md:grid-cols-1">
            {services.map((s) => (
              <label key={s.slug} className={checkboxRow}>
                <input type="checkbox" value={s.slug} {...register("services")} />
                {s.name}
              </label>
            ))}
          </div>
          <Field id="p-primary-service" label="Main service" error={errors.primaryService?.message}>
            <select
              {...register("primaryService")}
              {...a11yProps("p-primary-service", errors.primaryService?.message)}
              className={selectClasses}
            >
              <option value="">First one chosen</option>
              {services
                .filter((s) => chosenServices?.includes(s.slug))
                .map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
        </CheckboxGroup>

        <CheckboxGroup legend="Industries you work with" error={errors.industries?.message}>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {industries.map((i) => (
              <label key={i.slug} className={checkboxRow}>
                <input type="checkbox" value={i.slug} {...register("industries")} />
                {i.name}
              </label>
            ))}
          </div>
          <Field
            id="p-primary-industry"
            label="Main industry"
            optional
            error={errors.primaryIndustry?.message}
          >
            <select
              {...register("primaryIndustry")}
              {...a11yProps("p-primary-industry", errors.primaryIndustry?.message)}
              className={selectClasses}
            >
              <option value="">None</option>
              {industries
                .filter((i) => chosenIndustries?.includes(i.slug))
                .map((i) => (
                  <option key={i.slug} value={i.slug}>
                    {i.name}
                  </option>
                ))}
            </select>
          </Field>
        </CheckboxGroup>
      </div>

      <CheckboxGroup legend="Where you're based or work" error={errors.locations?.message}>
        <p className="-mt-1 mb-2 text-small">
          Choosing a country lists you on its page, including its cities&apos; pages.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
          {isSubmitting ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
