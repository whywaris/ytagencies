"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Mail } from "lucide-react";
import { useState } from "react";
import {
  useForm,
  useWatch,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form";

import { a11yProps, Field, Honeypot, textareaClasses } from "@/components/forms/field";
import { RequestProForm } from "@/components/forms/request-pro-form";
import { Turnstile } from "@/components/forms/turnstile";
import { BillingToggle } from "@/components/pro-billing";
import { Input } from "@/components/ui/input";
import { startCheckout } from "@/lib/actions/billing";
import { requestAccess, startClaim, submitClaimProof } from "@/lib/actions/claims";
import {
  accessRequestSchema,
  claimProofSchema,
  claimSchema,
  type AccessRequestInput,
  type ClaimInput,
  type ClaimProofInput,
} from "@/lib/validation/auth";
import type { FormResult } from "@/lib/validation/lead";

// /claim/<slug>: the claim card's forms (docs/mockups/claim.html). Every action re-checks on the
// server: ownership only after a confirmed domain email or an admin's review (SECURITY.md).

export const btnPrimary =
  "inline-flex h-[46px] w-full items-center justify-center rounded-full bg-accent px-[22px] text-[15px] font-semibold text-on-accent shadow-[0_1px_2px_rgba(31,94,255,.3),0_8px_20px_-6px_rgba(31,94,255,.45)] transition-transform duration-150 motion-safe:hover:-translate-y-px disabled:opacity-60";
export const btnLight =
  "inline-flex h-[46px] w-full items-center justify-center rounded-full border border-line bg-raised px-[22px] text-[15px] font-semibold hover:border-text-2";
const linkBtn = "font-semibold text-accent hover:underline";
const h1 = "text-[26px] leading-tight font-[650] tracking-[-0.03em]";
const sub = "mt-1.5 text-[15px] text-text-2";

/** The submit / error / Turnstile wiring the three forms share. */
function useClaimForm<T extends FieldValues>(
  form: UseFormReturn<T>,
  action: (v: T) => Promise<FormResult<unknown>>,
  onDone: (v: T, data: unknown) => void,
) {
  const [formError, setFormError] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const res = await action(values);
    if (res.ok) return onDone(values, res.data);
    setTurnstileReset((n) => n + 1); // tokens are single-use
    setFormError(res.error);
    for (const [k, m] of Object.entries(res.fieldErrors ?? {}))
      form.setError(k as Path<T>, { message: m });
  });
  const err = (k: Path<T>) => {
    const m = form.formState.errors[k]?.message;
    return typeof m === "string" ? m : undefined;
  };
  const bot = (
    <>
      <Honeypot {...form.register("website" as Path<T>)} />
      <div className="mt-4 flex flex-col gap-2">
        <Turnstile
          resetKey={turnstileReset}
          onToken={(t) =>
            form.setValue("turnstileToken" as Path<T>, t as T[Path<T>], {
              shouldValidate: form.formState.isSubmitted,
            })
          }
        />
        {err("turnstileToken" as Path<T>) && (
          <p className="text-[14px] text-destructive">{err("turnstileToken" as Path<T>)}</p>
        )}
      </div>
    </>
  );
  const alert = formError && (
    <p role="alert" className="mt-4 rounded-md border border-destructive p-3 text-destructive">
      {formError}
    </p>
  );
  return { onSubmit, err, bot, alert };
}

const emailDomain = (email: string) => email.split("@")[1]?.toLowerCase() ?? "";
const domainMatches = (email: string, domain: string | null) => {
  const d = emailDomain(email);
  return !!domain && !!d && (d === domain || d.endsWith(`.${domain}`));
};

/** Step 2: confirm a work email (a link on the agency's domain), or send proof for review. */
export function ClaimStep({
  agencySlug,
  agencyName,
  domain,
  signedInAs,
}: {
  agencySlug: string;
  agencyName: string;
  domain: string | null;
  signedInAs: string;
}) {
  const [view, setView] = useState<"email" | "proof">("email");
  const [sent, setSent] = useState<{ kind: "verify" | "review" | "proof"; email: string } | null>(
    null,
  );

  if (sent)
    return (
      <div role="status" className="text-center">
        <span className="mx-auto mb-[18px] grid size-[60px] place-items-center rounded-[18px] bg-(--accent-soft) text-(--accent-on-soft)">
          <Mail className="size-7" aria-hidden />
        </span>
        <h2 className={h1}>{sent.kind === "verify" ? "Check your inbox" : "Sent for review"}</h2>
        <p className={sub}>
          {sent.kind === "verify" ? (
            <>
              We sent a link to <b className="text-text">{sent.email}</b>. Open it while signed in
              to finish claiming {agencyName}. The link works for 24 hours.
            </>
          ) : (
            "We check it by hand, usually within 2 business days, and email you when it's decided."
          )}
        </p>
        {sent.kind !== "proof" && (
          <button type="button" className={`${btnLight} mt-[18px]`} onClick={() => setSent(null)}>
            Use a different email
          </button>
        )}
      </div>
    );

  return view === "email" ? (
    <EmailForm
      agencySlug={agencySlug}
      domain={domain}
      signedInAs={signedInAs}
      onProof={() => setView("proof")}
      onSent={(kind, email) => setSent({ kind, email })}
    />
  ) : (
    <ProofForm
      agencySlug={agencySlug}
      agencyName={agencyName}
      onBack={() => setView("email")}
      onSent={() => setSent({ kind: "proof", email: signedInAs })}
    />
  );
}

function EmailForm({
  agencySlug,
  domain,
  signedInAs,
  onProof,
  onSent,
}: {
  agencySlug: string;
  domain: string | null;
  signedInAs: string;
  onProof: () => void;
  onSent: (kind: "verify" | "review", email: string) => void;
}) {
  const form = useForm<ClaimInput>({
    resolver: zodResolver(claimSchema),
    // The account email is a good first guess when it's on the agency's domain.
    defaultValues: {
      agencySlug,
      workEmail: domainMatches(signedInAs, domain) ? signedInAs : "",
      turnstileToken: "",
      website: "",
    },
  });
  const email = useWatch({ control: form.control, name: "workEmail" }) ?? "";
  const { onSubmit, err, bot, alert } = useClaimForm(form, startClaim, (v, data) =>
    onSent((data as { kind: "verify" | "review" }).kind, v.workEmail),
  );
  const matches = domainMatches(email, domain);

  return (
    <form onSubmit={onSubmit} noValidate>
      <input type="hidden" {...form.register("agencySlug")} />
      <Field id="claim-email" label="Work email" error={err("workEmail")}>
        <Input
          type="email"
          autoComplete="email"
          placeholder={domain ? `you@${domain}` : undefined}
          {...form.register("workEmail")}
          {...a11yProps("claim-email", err("workEmail"))}
        />
      </Field>
      <p aria-live="polite" className="mt-2 text-[13px]">
        {matches ? (
          <span className="flex items-center gap-2 font-semibold text-(--mint)">
            <Check className="size-3.5" aria-hidden />
            Matches the agency&apos;s website. You&apos;ll get access as soon as you open the link.
          </span>
        ) : domain && emailDomain(email) ? (
          <span className="text-text-2">
            Not on {domain}: we&apos;ll check it by hand within 2 business days.
          </span>
        ) : null}
      </p>
      {alert}
      {bot}
      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className={`${btnPrimary} mt-[18px]`}
      >
        {form.formState.isSubmitting ? "Sending…" : "Send confirmation link"}
      </button>
      <div className="mt-[22px] mb-1 flex items-center gap-3 text-[13px] text-text-2 before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        or
      </div>
      <p className="text-[14.5px] text-text-2">
        No email on {domain ?? "that domain"}?{" "}
        <button type="button" className={linkBtn} onClick={onProof}>
          Send proof instead
        </button>
        . We check it by hand within 2 business days.
      </p>
    </form>
  );
}

function ProofForm({
  agencySlug,
  agencyName,
  onBack,
  onSent,
}: {
  agencySlug: string;
  agencyName: string;
  onBack: () => void;
  onSent: () => void;
}) {
  const form = useForm<ClaimProofInput>({
    resolver: zodResolver(claimProofSchema),
    defaultValues: {
      agencySlug,
      role: "",
      linkedinUrl: "",
      note: "",
      turnstileToken: "",
      website: "",
    },
  });
  const { onSubmit, err, bot, alert } = useClaimForm(form, submitClaimProof, onSent);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <h2 className={h1}>Send proof</h2>
        <p className={sub}>
          Tell us who you are at {agencyName}. We&apos;ll review it within 2 business days and email
          you.
        </p>
      </div>
      <Field id="proof-role" label="Your role" error={err("role")}>
        <Input
          placeholder="Founder, Head of Growth…"
          {...form.register("role")}
          {...a11yProps("proof-role", err("role"))}
        />
      </Field>
      <Field id="proof-li" label="Your LinkedIn profile" error={err("linkedinUrl")}>
        <Input
          type="url"
          placeholder="https://linkedin.com/in/…"
          {...form.register("linkedinUrl")}
          {...a11yProps("proof-li", err("linkedinUrl"))}
        />
      </Field>
      <Field id="proof-note" label="Anything else that helps" optional error={err("note")}>
        <textarea
          rows={4}
          placeholder="For example, why your email is on a different domain"
          className={textareaClasses}
          {...form.register("note")}
          {...a11yProps("proof-note", err("note"))}
        />
      </Field>
      {alert}
      {bot}
      <button type="submit" disabled={form.formState.isSubmitting} className={btnPrimary}>
        {form.formState.isSubmitting ? "Sending…" : "Send for review"}
      </button>
      <button type="button" className={`${linkBtn} self-start text-[14.5px]`} onClick={onBack}>
        Back to email confirmation
      </button>
    </form>
  );
}

/** Someone else manages the listing: ask us for access (Admin → Inbox). */
export function RequestAccessForm({ agencySlug }: { agencySlug: string }) {
  const [sent, setSent] = useState(false);
  const form = useForm<AccessRequestInput>({
    resolver: zodResolver(accessRequestSchema),
    defaultValues: { agencySlug, role: "", why: "", turnstileToken: "", website: "" },
  });
  const { onSubmit, err, bot, alert } = useClaimForm(form, requestAccess, () => setSent(true));
  if (sent)
    return (
      <p role="status" className="mt-[18px] rounded-2xl bg-surface p-4 text-[14px]">
        Request sent. We&apos;ll contact the current manager and the agency, and email you with the
        outcome.
      </p>
    );
  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
      <Field id="access-role" label="Your role at the agency" error={err("role")}>
        <Input
          placeholder="Founder, Head of Growth…"
          {...form.register("role")}
          {...a11yProps("access-role", err("role"))}
        />
      </Field>
      <Field id="access-why" label="Why you need access" error={err("why")}>
        <textarea
          rows={4}
          placeholder="For example, the person who claimed it has left the agency"
          className={textareaClasses}
          {...form.register("why")}
          {...a11yProps("access-why", err("why"))}
        />
      </Field>
      {alert}
      {bot}
      <button type="submit" disabled={form.formState.isSubmitting} className={btnPrimary}>
        {form.formState.isSubmitting ? "Sending…" : "Request access"}
      </button>
    </form>
  );
}

/** Step 3: monthly or yearly, then Creem checkout (or Request Pro while payments are off). */
export function ChoosePro({
  agencyId,
  agencyUrl,
  monthly,
  yearly,
  saving,
  live,
  from = "claim",
}: {
  agencyId: string;
  agencyUrl: string;
  monthly: number;
  yearly: number;
  saving: number;
  live: boolean;
  /** Where Creem sends the buyer back (lib/actions/billing.ts). */
  from?: "claim" | "billing";
}) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  return (
    <div className="flex flex-col gap-4">
      <BillingToggle value={period} onChange={setPeriod} saving={saving} />
      <p className="text-[30px] font-[650] tracking-[-0.025em] tabular-nums" aria-live="polite">
        ${period === "monthly" ? monthly : yearly}
        <small className="text-[15px] font-medium text-text-2">
          {period === "monthly" ? " a month" : " a year"}
        </small>
      </p>
      {live ? (
        <form
          action={startCheckout.bind(null, agencyId, period === "yearly" ? "year" : "month", from)}
        >
          <button type="submit" className={btnPrimary}>
            Get Pro
          </button>
          <p className="mt-2 text-[13px] text-text-2">Secure checkout by Creem. Cancel any time.</p>
        </form>
      ) : (
        <RequestProForm agency={agencyUrl} period={period} label="Get Pro" />
      )}
    </div>
  );
}
