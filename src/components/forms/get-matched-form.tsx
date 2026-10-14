"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  a11yProps,
  Field,
  Honeypot,
  PrivacyNotice,
  selectClasses,
  textareaClasses,
} from "@/components/forms/field";
import { Turnstile } from "@/components/forms/turnstile";
import { Input } from "@/components/ui/input";
import { submitGetMatched } from "@/lib/actions/leads";
import { prefillFrom, STEP1_FIELDS } from "@/lib/get-matched";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";
import {
  BUDGET_RANGES,
  GOALS,
  getMatchedSchema,
  PRIOR_AGENCY,
  START_TIMELINES,
  type GetMatchedData,
  type GetMatchedInput,
} from "@/lib/validation/lead";

// Get matched in two steps (the project, then the business's details) and a sent screen that
// replaces the form. Step 1 is validated on its own before Continue; the server re-validates all
// of it (lib/actions/leads.ts).

type Option = { slug: string; name: string };
type Link = { href: string; label: string };
type Sent = { email: string; page: Link | null; guide: Link | null };

const STEP_NAMES = { 1: "Your project", 2: "Your details" } as const;
const primary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 font-semibold text-on-accent transition-colors duration-150 hover:bg-(--accent-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";
const secondary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line px-5 font-medium hover:border-text-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function GetMatchedForm({
  services,
  industries,
}: {
  services: Option[];
  industries: Option[];
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [fromSearch, setFromSearch] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const sentHeading = useRef<HTMLHeadingElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    trigger,
    control,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<GetMatchedInput, unknown, GetMatchedData>({
    resolver: zodResolver(getMatchedSchema),
    defaultValues: {
      service: "",
      industry: "",
      name: "",
      email: "",
      businessUrl: "",
      channelUrl: "",
      customerLocation: "",
      priorAgency: "",
      message: "",
      turnstileToken: "",
      website: "",
      ref: "",
    },
  });
  const [service, industry, goal, budget, start] = useWatch({
    control,
    name: ["service", "industry", "goal", "budget", "start"],
  });

  // Prefill from the link, read after hydration so the page stays static.
  useEffect(() => {
    const p = prefillFrom(
      window.location.search,
      services.map((s) => s.slug),
      industries.map((i) => i.slug),
    );
    if (p.service) setValue("service", p.service);
    if (p.industry) setValue("industry", p.industry);
    if (p.ref) setValue("ref", p.ref);
    if (p.message) setValue("message", p.message);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only readable after mount
    setFromSearch(p.fromSearch);
  }, [services, industries, setValue]);

  useEffect(() => {
    if (sent) sentHeading.current?.focus();
  }, [sent]);

  const goTo = (s: 1 | 2) => {
    setStep(s);
    // Focus the new step's heading so screen readers and keyboards start there.
    requestAnimationFrame(() => document.getElementById("gm-step")?.focus());
  };

  const onContinue = async () => {
    if (await trigger([...STEP1_FIELDS])) goTo(2);
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitGetMatched(values);
    if (result.ok) {
      track("lead_submitted", {
        service: values.service,
        industry: values.industry,
        budget_range: values.budget,
        goal: values.goal,
      });
      setSent({ email: values.email, page: result.data.page, guide: result.data.guide });
      return;
    }
    setTurnstileReset((n) => n + 1); // tokens are single-use
    setFormError(result.error);
    const fields = Object.keys(result.fieldErrors ?? {});
    for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
      setError(field as keyof GetMatchedInput, { message });
    if (fields.some((f) => (STEP1_FIELDS as readonly string[]).includes(f))) goTo(1);
  });

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-5 rounded-[22px] border border-line bg-raised p-6 md:p-8">
        <span
          aria-hidden
          className="hero-pop grid size-14 place-items-center rounded-full bg-(--mint-soft) text-(--mint)"
        >
          <Check className="size-7 [stroke-width:2.5]" />
        </span>
        <div role="status" className="flex flex-col gap-3">
          <h2 ref={sentHeading} tabIndex={-1} className="text-h2 outline-none">
            Request sent. Check your inbox.
          </h2>
          <p className="text-text-2">
            We&apos;ve emailed you a copy at <strong className="text-text">{sent.email}</strong>.
            Agencies that fit will reply to you directly, as soon as possible. If no agency fits
            your request, we&apos;ll tell you.
          </p>
        </div>
        {(sent.page || sent.guide) && (
          <div className="flex w-full flex-col gap-2 border-t border-line pt-5">
            <p className="font-semibold">While you wait</p>
            <ul className="flex flex-col">
              {[sent.page, sent.guide].map(
                (l) =>
                  l && (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="flex min-h-11 items-center gap-1.5 text-accent hover:underline"
                      >
                        {l.label}
                        <ArrowRight className="size-4 [stroke-width:2]" aria-hidden />
                      </Link>
                    </li>
                  ),
              )}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const err = (k: keyof GetMatchedInput) => errors[k]?.message;
  const nameOf = (list: Option[], slug: string | undefined) =>
    list.find((o) => o.slug === slug)?.name;
  const summary = [
    nameOf(services, service),
    nameOf(industries, industry),
    GOALS.find((g) => g.value === goal)?.label,
    BUDGET_RANGES.find((b) => b.value === budget)?.short,
    START_TIMELINES.find((t) => t.value === start)?.label,
  ].filter(Boolean);

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6 rounded-[22px] border border-line bg-raised p-5 md:p-8"
    >
      <div className="flex flex-col gap-2">
        <p className="text-[12.5px] font-semibold tracking-[0.08em] text-text-2">
          STEP {step} OF 2
        </p>
        <div
          role="progressbar"
          aria-label="Form progress"
          aria-valuemin={1}
          aria-valuemax={2}
          aria-valuenow={step}
          className="h-1.5 overflow-hidden rounded-full bg-surface"
        >
          <span
            className="block h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>
        <h2 id="gm-step" tabIndex={-1} className="text-h3 outline-none">
          {STEP_NAMES[step]}
        </h2>
      </div>

      {formError && (
        <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
          {formError}
        </p>
      )}

      {/* Step 1 stays mounted (hidden) so its answers are kept and submitted with step 2. */}
      <div hidden={step !== 1} className="flex flex-col gap-6">
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
        {fromSearch && (
          <p className="-mt-3 flex items-center gap-1.5 text-small text-(--mint)">
            <Check className="size-4 [stroke-width:2.5]" aria-hidden />
            Filled in from your search
          </p>
        )}

        <Chips
          legend="What's your main goal?"
          name="goal"
          options={GOALS.map((g) => ({ value: g.value, label: g.label }))}
          value={goal}
          onChange={(v) => setValue("goal", v as GetMatchedInput["goal"], { shouldValidate: true })}
          error={err("goal")}
        />
        <Chips
          legend="Monthly budget"
          name="budget"
          options={BUDGET_RANGES.map((b) => ({ value: b.value, label: b.short }))}
          value={budget}
          onChange={(v) =>
            setValue("budget", v as GetMatchedInput["budget"], { shouldValidate: true })
          }
          error={err("budget")}
        />
        <Chips
          legend="When do you want to start?"
          name="start"
          options={START_TIMELINES.map((t) => ({ value: t.value, label: t.label }))}
          value={start}
          onChange={(v) =>
            setValue("start", v as GetMatchedInput["start"], { shouldValidate: true })
          }
          error={err("start")}
        />

        <button type="button" onClick={onContinue} className={cn(primary, "self-start")}>
          Continue
          <ArrowRight className="size-5 [stroke-width:2]" aria-hidden />
        </button>
      </div>

      <div hidden={step !== 2} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <ul aria-label="Your project" className="flex flex-wrap gap-1.5">
            {summary.map((s) => (
              <li key={s} className="rounded-full bg-surface px-3 py-1 text-[14px]">
                {s}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => goTo(1)}
            className="min-h-11 px-1 font-medium text-accent hover:underline"
          >
            Edit
          </button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="gm-name" label="Your name" error={err("name")}>
            <Input
              placeholder="Enter your name"
              {...register("name")}
              {...a11yProps("gm-name", err("name"))}
              autoComplete="name"
            />
          </Field>
          <Field id="gm-email" label="Email" error={err("email")}>
            <Input
              type="email"
              placeholder="you@yourbusiness.com"
              {...register("email")}
              {...a11yProps("gm-email", err("email"))}
              autoComplete="email"
            />
          </Field>
          <Field id="gm-business" label="Business website" optional error={err("businessUrl")}>
            <Input
              inputMode="url"
              placeholder="ytagencies.com"
              {...register("businessUrl")}
              {...a11yProps("gm-business", err("businessUrl"))}
              autoComplete="url"
            />
          </Field>
          <Field id="gm-channel" label="Your YouTube channel" optional error={err("channelUrl")}>
            <Input
              inputMode="url"
              placeholder="youtube.com/@yourchannel"
              {...register("channelUrl")}
              {...a11yProps("gm-channel", err("channelUrl"))}
            />
          </Field>
          <Field
            id="gm-where"
            label="Where are your customers?"
            optional
            error={err("customerLocation")}
          >
            <Input
              placeholder="e.g. Austin, US · or Worldwide"
              {...register("customerLocation")}
              {...a11yProps("gm-where", err("customerLocation"))}
            />
          </Field>
          <Field id="gm-prior" label="Worked with an agency before?" optional>
            <select
              {...register("priorAgency")}
              {...a11yProps("gm-prior", err("priorAgency"))}
              className={selectClasses}
            >
              <option value="">Choose one</option>
              {PRIOR_AGENCY.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field id="gm-message" label="What do you want to achieve?" optional error={err("message")}>
          <textarea
            {...register("message")}
            {...a11yProps("gm-message", err("message"))}
            rows={4}
            className={textareaClasses}
          />
        </Field>

        <Honeypot {...register("website")} />

        <div className="contents">
          <Turnstile
            resetKey={turnstileReset}
            onToken={(token) => setValue("turnstileToken", token, { shouldValidate: isSubmitted })}
          />
          {err("turnstileToken") && (
            <p className="text-[14px] text-destructive">{err("turnstileToken")}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={isSubmitting} className={primary}>
            {isSubmitting ? "Sending…" : "Send my request"}
          </button>
          <button type="button" onClick={() => goTo(1)} className={secondary}>
            <ArrowLeft className="size-5 [stroke-width:2]" aria-hidden />
            Back
          </button>
        </div>
        <PrivacyNotice sharedWith="the agencies we match you with (up to 3)" />
      </div>
    </form>
  );
}

/** One choice from a few: real buttons in a fieldset, aria-pressed, 44px tall. */
function Chips({
  legend,
  name,
  options,
  value,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (v: string) => void;
  error?: string;
}) {
  const errorId = `gm-${name}-error`;
  return (
    <fieldset
      className="flex flex-col gap-2.5"
      aria-invalid={!!error}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="mb-2.5 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              value === o.value
                ? "border-accent bg-accent-soft font-medium text-(--accent-on-soft)"
                : "border-line hover:border-text-2",
            )}
          >
            {value === o.value && <Check className="size-4 [stroke-width:2.5]" aria-hidden />}
            {o.label}
          </button>
        ))}
      </div>
      {error && (
        <p id={errorId} className="text-[14px] text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
