"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { selectClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBasics } from "@/lib/actions/dashboard";
import type { BasicsInput } from "@/lib/validation/dashboard";
import { TEAM_SIZES } from "@/lib/validation/admin";

// Tagline, website, founded year, team size and languages: editable on any plan.
export function BasicsForm({ agencyId, defaults }: { agencyId: string; defaults: BasicsInput }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = (k: keyof BasicsInput) => String(data.get(k) ?? "");
    startTransition(async () => {
      const res = await updateBasics(agencyId, {
        tagline: value("tagline"),
        website: value("website"),
        foundedYear: value("foundedYear"),
        teamSize: value("teamSize"),
        languages: value("languages"),
      });
      setErrors(res.ok ? {} : (res.fieldErrors ?? {}));
      setStatus(res.ok ? { ok: true, message: "Saved." } : { ok: false, message: res.error });
      if (res.ok) router.refresh();
    });
  }

  const hint = (name: keyof BasicsInput, text: string) => (
    <p id={`basics-${name}-hint`} className={errors[name] ? "text-destructive" : "text-text-2"}>
      {errors[name] ?? text}
    </p>
  );
  const label = (name: keyof BasicsInput, text: string) => (
    <label htmlFor={`basics-${name}`} className="text-[14px] font-medium">
      {text} <span className="font-normal text-text-2">(optional)</span>
    </label>
  );
  const a11y = (name: keyof BasicsInput) => ({
    id: `basics-${name}`,
    name,
    "aria-invalid": !!errors[name],
    "aria-describedby": `basics-${name}-hint`,
  });

  return (
    <form onSubmit={onSubmit} className="flex max-w-reading flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        {label("tagline", "Tagline")}
        <Input {...a11y("tagline")} defaultValue={defaults.tagline} maxLength={160} />
        {hint("tagline", "One line under your name in the directory.")}
      </div>
      <div className="flex flex-col gap-1.5">
        {label("website", "Website")}
        <Input
          {...a11y("website")}
          defaultValue={defaults.website}
          inputMode="url"
          maxLength={300}
          placeholder="https://"
        />
        {hint(
          "website",
          "A full link starting with https://. Changing it sends a Verified badge back for review.",
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          {label("foundedYear", "Founded")}
          <Input
            {...a11y("foundedYear")}
            defaultValue={defaults.foundedYear}
            inputMode="numeric"
            maxLength={4}
          />
          {hint("foundedYear", "The year, like 2018.")}
        </div>
        <div className="flex flex-col gap-1.5">
          {label("teamSize", "Team size")}
          <select {...a11y("teamSize")} defaultValue={defaults.teamSize} className={selectClasses}>
            <option value="">Not set</option>
            {TEAM_SIZES.map((t) => (
              <option key={t} value={t}>
                {t} people
              </option>
            ))}
          </select>
          {hint("teamSize", "People on your team.")}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {label("languages", "Languages")}
        <Input {...a11y("languages")} defaultValue={defaults.languages} maxLength={200} />
        {hint("languages", "Separated by commas, like English, Spanish.")}
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save basics"}
        </Button>
        {status && (
          <p
            role={status.ok ? "status" : "alert"}
            className={status.ok ? "text-text" : "text-destructive"}
          >
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}
