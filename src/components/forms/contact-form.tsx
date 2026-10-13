"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  a11yProps,
  Field,
  Honeypot,
  selectClasses,
  textareaClasses,
} from "@/components/forms/field";
import { Turnstile } from "@/components/forms/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitContact } from "@/lib/actions/contact";
import { CONTACT_TOPICS, topicOf, type ContactTopic } from "@/lib/contact-topics";
import { contactSchema, type ContactInput } from "@/lib/validation/contact";

export function ContactForm({
  initialTopic,
  initialAgencyUrl,
}: {
  initialTopic: ContactTopic;
  initialAgencyUrl: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; topic: ContactTopic } | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const successHeading = useRef<HTMLHeadingElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      topic: initialTopic,
      name: "",
      email: "",
      message: "",
      agencyUrl: initialAgencyUrl,
      turnstileToken: "",
      website: "",
    },
  });
  const topic = topicOf(useWatch({ control, name: "topic" }));

  useEffect(() => {
    if (sent) successHeading.current?.focus();
  }, [sent]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitContact(values);
    if (result.ok) return setSent({ email: values.email, topic: values.topic });
    setTurnstileReset((n) => n + 1);
    setFormError(result.error);
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as keyof ContactInput, { message });
    }
  });

  if (sent) {
    const t = topicOf(sent.topic);
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-6" role="status">
        <h2 ref={successHeading} tabIndex={-1} className="text-h3 outline-none">
          Message sent
        </h2>
        <p>
          Thanks. We&apos;ve sent a confirmation to <strong>{sent.email}</strong>
          {t.response ? ` and we'll reply ${t.response}.` : " and we'll reply as soon as we can."}
        </p>
        <Link href="/" className="self-start text-accent hover:underline">
          Back to the directory
        </Link>
      </div>
    );
  }

  const err = (k: keyof ContactInput) => errors[k]?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-6">
      {formError && (
        <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Field id="ct-topic" label="Topic" error={err("topic")}>
          <select
            {...register("topic")}
            {...a11yProps("ct-topic", err("topic"))}
            aria-describedby={err("topic") ? "ct-topic-note ct-topic-error" : "ct-topic-note"}
            className={selectClasses}
          >
            {CONTACT_TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <p id="ct-topic-note" className="text-small" aria-live="polite">
          {topic.note}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="ct-name" label="Your name" error={err("name")}>
          <Input {...register("name")} {...a11yProps("ct-name", err("name"))} autoComplete="name" />
        </Field>
        <Field id="ct-email" label="Email" error={err("email")}>
          <Input
            type="email"
            {...register("email")}
            {...a11yProps("ct-email", err("email"))}
            autoComplete="email"
          />
        </Field>
      </div>

      {topic.id === "report" && (
        <Field id="ct-agency" label="Link to the listing" error={err("agencyUrl")}>
          <Input
            type="url"
            inputMode="url"
            placeholder="https://ytagencies.com/agency/…"
            {...register("agencyUrl")}
            {...a11yProps("ct-agency", err("agencyUrl"))}
          />
        </Field>
      )}

      <Field id="ct-message" label="Message" error={err("message")}>
        <textarea
          {...register("message")}
          {...a11yProps("ct-message", err("message"))}
          rows={6}
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

      <div className="flex flex-col gap-4">
        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Sending…" : "Send message"}
        </Button>
        <p className="text-small">
          We use your details only to answer you. See our{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
