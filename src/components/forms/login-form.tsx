"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { a11yProps, Field, Honeypot } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMagicLink } from "@/lib/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

export function LoginForm({ next }: { next: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", next, website: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await sendMagicLink(values);
    if (result.ok) return setSentTo(values.email);
    setFormError(result.error);
  });

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg bg-surface p-6">
        <p className="text-h3">Check your email</p>
        <p>
          We sent a sign-in link to <strong>{sentTo}</strong>. It works once and expires in an hour.
          Open it on this device.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-6">
      {formError && (
        <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
          {formError}
        </p>
      )}
      <input type="hidden" {...register("next")} />
      <Field id="login-email" label="Email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          {...register("email")}
          {...a11yProps("login-email", errors.email?.message)}
        />
      </Field>
      <Honeypot {...register("website")} />
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
