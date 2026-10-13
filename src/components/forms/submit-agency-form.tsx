"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  a11yProps,
  checkboxRow,
  CheckboxGroup,
  Field,
  Honeypot,
  selectClasses,
  textareaClasses,
} from "@/components/forms/field";
import { Turnstile } from "@/components/forms/turnstile";
import { BillingToggle } from "@/components/pro-billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startSubmissionCheckout } from "@/lib/actions/billing";
import { submitAgency } from "@/lib/actions/listing";
import {
  AD_SPEND_OPTION,
  AD_SPENDS,
  MIN_CONTRACT_OPTION,
  MIN_CONTRACTS,
  PRICING_MODELS,
} from "@/lib/pricing";
import { PRICING_LABEL } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { submitAgencySchema, type SubmitAgencyInput } from "@/lib/validation/listing";
import { EMPTY_DETAILS, EMPTY_SERVICE_DETAIL, focusTotal } from "@/lib/validation/profile-details";

type Option = { slug: string; name: string };
type Country = Option & { cities: Option[] };
/** Other places they serve, besides the HQ. */
const MAX_OTHER_PLACES = 5;
type Done = { kind: "verify" | "review"; workEmail: string; agencyName: string; agencyId: string };

// /list-your-agency/new: four steps with a progress bar and a live preview (desktop). The same
// schema and action as before (lib/actions/listing.tsx): a free draft, reviewed by an admin. On
// approval it goes live unmanaged and the submitter becomes its owner. Optional "Subscribe now"
// pays for Pro up front so management starts as soon as it's approved.

const STEPS = [
  {
    title: "Basics",
    fields: [
      "name",
      "siteUrl",
      "hqCountry",
      "hqCity",
      "hqCityOther",
      "locations",
      "bestFor",
      "description",
    ],
  },
  {
    title: "Services and industries",
    fields: ["services", "industries", "serviceDetails", "industryFocus"],
  },
  { title: "Pricing", fields: ["minBudget", "pricingModel", "minContract", "adSpend", "setupFee"] },
  { title: "Confirm your work email", fields: ["workEmail", "turnstileToken"] },
] as const;

export function SubmitAgencyForm({
  services,
  industries,
  countries,
  live,
  prices,
}: {
  services: Option[];
  industries: Option[];
  /** Our locations: countries with their cities. */
  countries: Country[];
  /** Checkout is available (payments on and Creem configured): offer "Subscribe now". */
  live: boolean;
  prices: { monthly: number; yearly: number; saving: number };
}) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Done | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [subscribe, setSubscribe] = useState(false);
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [redirecting, startRedirect] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);

  const form = useForm<SubmitAgencyInput>({
    resolver: zodResolver(submitAgencySchema),
    defaultValues: {
      name: "",
      siteUrl: "",
      services: [],
      industries: [],
      locations: [],
      hqCountry: "",
      hqCity: "",
      hqCityOther: "",
      minBudget: "",
      pricingModel: "",
      minContract: "",
      adSpend: "",
      setupFee: "",
      description: "",
      workEmail: "",
      turnstileToken: "",
      website: "",
      ...EMPTY_DETAILS,
    },
  });
  const { register, setValue, setError, control, formState } = form;
  const v = useWatch({ control });
  const chosenServices = v.services ?? [];
  const places = v.locations ?? [];
  const hqCountry = countries.find((c) => c.slug === v.hqCountry);
  const hqPlace =
    v.hqCity === "other" ? v.hqCityOther : hqCountry?.cities.find((c) => c.slug === v.hqCity)?.name;
  const chosenIndustries = v.industries ?? [];
  const serviceTotal = focusTotal(chosenServices, (s) => v.serviceDetails?.[s]?.focus);
  const industryTotal = focusTotal(chosenIndustries, (i) => v.industryFocus?.[i]);

  // A chosen service needs a full detail object for the schema; only its focus is asked here.
  const servicesKey = chosenServices.join(",");
  useEffect(() => {
    for (const s of servicesKey.split(",").filter(Boolean))
      if (!form.getValues(`serviceDetails.${s}`))
        setValue(`serviceDetails.${s}`, EMPTY_SERVICE_DETAIL);
  }, [servicesKey, form, setValue]);

  useEffect(() => {
    heading.current?.focus();
  }, [step, done]);

  const err = (k: string) => {
    const m = (formState.errors as Record<string, { message?: unknown } | undefined>)[k]?.message;
    return typeof m === "string" ? m : undefined;
  };

  const next = async () => {
    setStepError(null);
    const ok = await form.trigger(STEPS[step].fields as unknown as (keyof SubmitAgencyInput)[]);
    if (!ok) return;
    if (step === 1) {
      // The schema's 100% check runs only on the full form; check it here so it shows now.
      if (serviceTotal !== null && serviceTotal !== 100)
        return setStepError(`Service focus should add up to 100% (now ${serviceTotal}%).`);
      if (industryTotal !== null && industryTotal !== 100)
        return setStepError(`Industry focus should add up to 100% (now ${industryTotal}%).`);
    }
    setStep((s) => s + 1);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const res = await submitAgency(values);
    if (res.ok) {
      setDone(res.data);
      if (subscribe && live && res.data.agencyId)
        startRedirect(() =>
          startSubmissionCheckout(res.data.agencyId, period === "yearly" ? "year" : "month"),
        );
      return;
    }
    setTurnstileReset((n) => n + 1); // tokens are single-use
    setFormError(res.error);
    for (const [k, m] of Object.entries(res.fieldErrors ?? {}))
      setError(k as keyof SubmitAgencyInput, { message: m });
    // Show the first step with an error.
    const first = STEPS.findIndex((s) => s.fields.some((f) => f in (res.fieldErrors ?? {})));
    if (first !== -1) setStep(first);
  });

  if (done)
    return (
      <div
        role="status"
        className="mx-auto flex max-w-reading flex-col gap-3 rounded-[22px] border border-line bg-raised p-6 md:p-8"
      >
        <h2 ref={heading} tabIndex={-1} className="text-h2 outline-none">
          Thanks, we&apos;ve got {done.agencyName || "your agency"}
        </h2>
        {redirecting ? (
          <p>Taking you to the payment page…</p>
        ) : (
          <>
            <p>
              We review every new agency before it goes live, usually within a few business days,
              and email you when it&apos;s published. It goes live as a free listing; Pro lets you
              manage it and receive inquiries.
            </p>
            <p>
              {done.kind === "verify"
                ? `Open the confirmation link we sent to ${done.workEmail} while signed in to this account. It expires in 24 hours.`
                : "We'll confirm that you work there during the review."}
            </p>
            <Link
              href="/dashboard"
              className="flex min-h-11 items-center text-accent hover:underline"
            >
              Go to your dashboard
            </Link>
          </>
        )}
      </div>
    );

  const price = v.minBudget ? `$${Number(v.minBudget).toLocaleString("en-US")}` : null;
  const name = (list: Option[], slug: string) => list.find((o) => o.slug === slug)?.name ?? slug;

  return (
    <div className="grid items-start gap-10 min-[980px]:grid-cols-[minmax(0,1fr)_340px]">
      <form onSubmit={onSubmit} noValidate className="relative flex min-w-0 flex-col gap-6">
        <div>
          <div className="flex justify-between text-[13px] text-text-2">
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
            <span>{STEPS[step].title}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Progress"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            className="mt-2 h-2 overflow-hidden rounded-full bg-surface"
          >
            <i
              className="block h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--violet))] transition-[width] duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <h2 ref={heading} tabIndex={-1} className="text-h2 outline-none">
          {STEPS[step].title}
        </h2>

        {(formError || stepError) && (
          <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
            {stepError ?? formError}
          </p>
        )}

        <div hidden={step !== 0} className="flex flex-col gap-6">
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
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 font-medium">Where you&apos;re based</legend>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field id="sa-hq-country" label="Country" error={err("hqCountry")}>
                <select
                  {...register("hqCountry", {
                    // A city from another country no longer fits.
                    onChange: () => setValue("hqCity", ""),
                  })}
                  {...a11yProps("sa-hq-country", err("hqCountry"))}
                  className={selectClasses}
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  {countries.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="sa-hq-city" label="City" optional error={err("hqCity")}>
                <select
                  {...register("hqCity")}
                  {...a11yProps("sa-hq-city", err("hqCity"))}
                  disabled={!hqCountry}
                  className={selectClasses}
                >
                  <option value="">Not listed by city</option>
                  {hqCountry?.cities.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                  <option value="other">Other (type it)</option>
                </select>
              </Field>
            </div>
            {v.hqCity === "other" && (
              <Field id="sa-hq-other" label="Your city" error={err("hqCityOther")}>
                <Input
                  maxLength={100}
                  autoComplete="address-level2"
                  {...register("hqCityOther")}
                  {...a11yProps("sa-hq-other", err("hqCityOther"))}
                />
              </Field>
            )}
          </fieldset>

          <CheckboxGroup
            legend={`Other places you serve (optional, up to ${MAX_OTHER_PLACES})`}
            error={err("locations")}
          >
            <p className="mb-2 text-small tabular-nums" aria-live="polite">
              {places.length} of {MAX_OTHER_PLACES} chosen
            </p>
            <div className="grid max-h-64 gap-x-6 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2">
              {countries.map((c) => (
                <div key={c.slug} className="flex flex-col">
                  {[c, ...c.cities].map((l, k) =>
                    l.slug === v.hqCountry || l.slug === v.hqCity ? null : (
                      <label
                        key={l.slug}
                        className={cn(checkboxRow, k === 0 ? "font-medium" : "pl-8")}
                      >
                        <input
                          type="checkbox"
                          value={l.slug}
                          disabled={places.length >= MAX_OTHER_PLACES && !places.includes(l.slug)}
                          {...register("locations")}
                        />
                        {l.name}
                      </label>
                    ),
                  )}
                </div>
              ))}
            </div>
          </CheckboxGroup>

          <Field id="sa-best" label="Best for" optional error={err("bestFor")}>
            <Input
              maxLength={120}
              placeholder="Ecommerce and gaming brands with $3k+ monthly budgets"
              {...register("bestFor")}
              {...a11yProps("sa-best", err("bestFor"))}
            />
          </Field>
          <Field id="sa-description" label="Short description" error={err("description")}>
            <textarea
              {...register("description")}
              {...a11yProps("sa-description", err("description"))}
              rows={5}
              placeholder="What you do, for whom, and what makes you good at it."
              className={textareaClasses}
            />
          </Field>
        </div>

        <div hidden={step !== 1} className="grid gap-8 md:grid-cols-2">
          <FocusGroup
            legend="Services you offer"
            error={err("services")}
            options={services}
            chosen={chosenServices}
            total={serviceTotal}
            checkbox={(slug) => <input type="checkbox" value={slug} {...register("services")} />}
            focus={(slug) => register(`serviceDetails.${slug}.focus`)}
          />
          <FocusGroup
            legend="Industries you work with"
            error={err("industries")}
            options={industries}
            chosen={chosenIndustries}
            total={industryTotal}
            checkbox={(slug) => <input type="checkbox" value={slug} {...register("industries")} />}
            focus={(slug) => register(`industryFocus.${slug}`)}
          />
        </div>

        <div hidden={step !== 2} className="grid gap-6 sm:grid-cols-2">
          <Field id="sa-budget" label="Starting price (US$)" error={err("minBudget")}>
            <Input
              inputMode="numeric"
              {...register("minBudget")}
              {...a11yProps("sa-budget", err("minBudget"))}
            />
          </Field>
          <Field id="sa-pricing" label="Pricing unit" error={err("pricingModel")}>
            <select
              {...register("pricingModel")}
              {...a11yProps("sa-pricing", err("pricingModel"))}
              className={selectClasses}
            >
              <option value="" disabled>
                Choose one
              </option>
              {PRICING_MODELS.map((m) => (
                <option key={m} value={m}>
                  {PRICING_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="sa-contract" label="Minimum contract" error={err("minContract")}>
            <select
              {...register("minContract")}
              {...a11yProps("sa-contract", err("minContract"))}
              className={selectClasses}
            >
              <option value="" disabled>
                Choose one
              </option>
              {MIN_CONTRACTS.map((m) => (
                <option key={m} value={m}>
                  {MIN_CONTRACT_OPTION[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="sa-adspend" label="Ad spend" error={err("adSpend")}>
            <select
              {...register("adSpend")}
              {...a11yProps("sa-adspend", err("adSpend"))}
              className={selectClasses}
            >
              <option value="" disabled>
                Choose one
              </option>
              {AD_SPENDS.map((m) => (
                <option key={m} value={m}>
                  {AD_SPEND_OPTION[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="sa-setup" label="Setup fee (US$)" optional error={err("setupFee")}>
            <Input
              inputMode="numeric"
              {...register("setupFee")}
              {...a11yProps("sa-setup", err("setupFee"))}
            />
          </Field>
        </div>

        <div hidden={step !== 3} className="flex flex-col gap-6">
          <Field id="sa-email" label="Your work email" error={err("workEmail")}>
            <Input
              type="email"
              {...register("workEmail")}
              {...a11yProps("sa-email", err("workEmail"))}
              autoComplete="email"
            />
          </Field>
          <p className="-mt-4 text-small">
            Use an email on your agency&apos;s website domain and we&apos;ll send a link that
            confirms you work there. Other addresses are checked by hand. Submitting is free.
          </p>
          {live && (
            <fieldset className="flex flex-col gap-3 rounded-[16px] border border-line p-4">
              <legend className="sr-only">Pro</legend>
              <label className={cn(checkboxRow, "font-medium")}>
                <input
                  type="checkbox"
                  checked={subscribe}
                  onChange={(e) => setSubscribe(e.target.checked)}
                />
                Subscribe to Pro now (optional)
              </label>
              <p className="text-small">
                Management starts as soon as we approve the listing: inquiries, editing and your
                website link. If we don&apos;t approve it, we refund you.
              </p>
              {subscribe && (
                <div className="flex flex-wrap items-center gap-3">
                  <BillingToggle value={period} onChange={setPeriod} saving={prices.saving} />
                  <span className="tabular-nums">
                    $
                    {period === "monthly" ? `${prices.monthly} a month` : `${prices.yearly} a year`}
                  </span>
                </div>
              )}
            </fieldset>
          )}
          <Honeypot {...register("website")} />
          <div className="flex flex-col gap-2">
            <Turnstile
              resetKey={turnstileReset}
              onToken={(t) =>
                setValue("turnstileToken", t, { shouldValidate: formState.isSubmitted })
              }
            />
            {err("turnstileToken") && (
              <p className="text-[14px] text-destructive">{err("turnstileToken")}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {step > 0 && (
            <Button type="button" variant="link" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting
                ? "Sending…"
                : subscribe && live
                  ? "Submit and continue to payment"
                  : "Submit for review"}
            </Button>
          )}
        </div>
      </form>

      <aside aria-label="Preview" className="sticky top-[84px] hidden min-[980px]:block">
        <p className="mb-2 text-[13px] text-text-2">Preview</p>
        <div className="rounded-[22px] border border-line bg-raised p-[22px] shadow-[0_1px_2px_rgba(20,25,40,.05),0_12px_32px_-12px_rgba(20,25,40,.14)]">
          <b className="block truncate text-[20px] tracking-[-0.02em]">{v.name || "Your agency"}</b>
          {v.siteUrl && (
            <span className="block truncate text-[13px] text-text-2">
              {v.siteUrl.replace(/^https?:\/\/(www\.)?/, "")}
            </span>
          )}
          {hqCountry && (
            <p className="mt-1 text-[13px] text-text-2">
              {[hqPlace, hqCountry.name].filter(Boolean).join(", ")}
              {places.length > 0 && ` + ${places.length} more`}
            </p>
          )}
          {v.bestFor && (
            <p className="mt-3 text-[14.5px] text-text-2">
              Best for <span className="font-semibold text-text">{v.bestFor}</span>
            </p>
          )}
          {(chosenServices.length > 0 || chosenIndustries.length > 0) && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {[
                ...chosenServices.map(
                  (s) => [name(services, s), v.serviceDetails?.[s]?.focus] as const,
                ),
                ...chosenIndustries.map(
                  (i) => [name(industries, i), v.industryFocus?.[i]] as const,
                ),
              ].map(([label, pct]) => (
                <li key={label} className="rounded-full bg-surface px-2.5 py-1 text-[12.5px]">
                  {label}
                  {pct ? ` · ${pct}%` : ""}
                </li>
              ))}
            </ul>
          )}
          {price && (
            <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-[14px] border border-line-2 tabular-nums">
              <div className="border-r border-line-2 p-3">
                <dt className="text-[11.5px] text-text-2">Starting price</dt>
                <dd className="text-[15px] font-semibold">
                  {price}
                  {v.pricingModel
                    ? ` ${PRICING_LABEL[v.pricingModel as keyof typeof PRICING_LABEL]?.toLowerCase() ?? ""}`
                    : ""}
                </dd>
              </div>
              <div className="p-3">
                <dt className="text-[11.5px] text-text-2">Contract</dt>
                <dd className="text-[15px] font-semibold">
                  {v.minContract
                    ? MIN_CONTRACT_OPTION[v.minContract as keyof typeof MIN_CONTRACT_OPTION]
                    : "Not set"}
                </dd>
              </div>
            </dl>
          )}
          {v.description && (
            <p className="mt-4 line-clamp-4 text-[14px] text-text-2">{v.description}</p>
          )}
        </div>
        <p className="mt-3 flex items-center gap-2 text-[13px] text-text-2">
          <Check className="size-3.5 text-(--mint)" aria-hidden />
          Reviewed before it goes live.
        </p>
      </aside>
    </div>
  );
}

function FocusGroup({
  legend,
  error,
  options,
  chosen,
  total,
  checkbox,
  focus,
}: {
  legend: string;
  error: string | undefined;
  options: Option[];
  chosen: string[];
  total: number | null;
  checkbox: (slug: string) => React.ReactNode;
  focus: (slug: string) => ReturnType<ReturnType<typeof useForm>["register"]>;
}) {
  return (
    <CheckboxGroup legend={legend} error={error}>
      <ul className="flex flex-col">
        {options.map((o) => (
          <li key={o.slug} className="flex items-center justify-between gap-3">
            <label className={checkboxRow}>
              {checkbox(o.slug)}
              {o.name}
            </label>
            {chosen.includes(o.slug) && (
              <label className="flex items-center gap-1.5 text-small">
                <span className="sr-only">{o.name} focus</span>
                <Input
                  inputMode="numeric"
                  maxLength={3}
                  className="h-9 w-16 text-right"
                  {...focus(o.slug)}
                />
                %
              </label>
            )}
          </li>
        ))}
      </ul>
      {chosen.length > 0 && (
        <p
          aria-live="polite"
          className={cn(
            "mt-2 text-small tabular-nums",
            total !== null && total !== 100 && "text-destructive",
          )}
        >
          Focus: {total ?? 0}% of 100%. Optional; if you fill it in, it should add up to 100%.
        </p>
      )}
    </CheckboxGroup>
  );
}
