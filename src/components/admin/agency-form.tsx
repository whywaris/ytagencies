"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { a11yProps, Field, selectClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAgency } from "@/lib/actions/admin";
import { agencySchema, TEAM_SIZES, type AgencyInput } from "@/lib/validation/admin";

type LocationOption = { slug: string; name: string; group: string };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export function AgencyForm({
  id,
  defaults,
  locations,
  slugLocked,
}: {
  id: string | null;
  defaults: AgencyInput;
  locations: LocationOption[];
  slugLocked: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<AgencyInput>({ resolver: zodResolver(agencySchema), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    setStatus(null);
    const res = await saveAgency(id, values);
    if (res.ok) {
      if (!id) return router.push(`/admin/agencies/${res.data.id}`);
      setStatus({ ok: true, message: "Saved." });
      return router.refresh();
    }
    setStatus({ ok: false, message: res.error });
    for (const [k, m] of Object.entries(res.fieldErrors ?? {}))
      setError(k as keyof AgencyInput, { message: m });
  });

  const groups = [...new Set(locations.map((l) => l.group))];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="a-name" label="Name" error={errors.name?.message}>
          <Input
            {...register("name", {
              // New agencies: suggest a slug from the name until the slug is edited by hand.
              onChange: (e) => {
                if (!id && !dirtyFields.slug) setValue("slug", slugify(e.target.value));
              },
            })}
            {...a11yProps("a-name", errors.name?.message)}
          />
        </Field>
        <Field id="a-slug" label="Slug" error={errors.slug?.message}>
          <Input
            {...register("slug", { onBlur: () => setValue("slug", slugify(getValues("slug"))) })}
            {...a11yProps("a-slug", errors.slug?.message)}
            readOnly={slugLocked}
            aria-readonly={slugLocked || undefined}
          />
        </Field>
      </div>
      {slugLocked && (
        <p className="-mt-4 text-small">The slug is locked because this agency is published.</p>
      )}
      <Field id="a-tagline" label="Tagline" optional error={errors.tagline?.message}>
        <Input {...register("tagline")} {...a11yProps("a-tagline", errors.tagline?.message)} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="a-website" label="Website" optional error={errors.website?.message}>
          <Input
            type="url"
            placeholder="https://"
            {...register("website")}
            {...a11yProps("a-website", errors.website?.message)}
          />
        </Field>
        <Field id="a-hq" label="Headquarters" optional error={errors.hqLocation?.message}>
          <select
            {...register("hqLocation")}
            {...a11yProps("a-hq", errors.hqLocation?.message)}
            className={selectClasses}
          >
            <option value="">Not set</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {locations
                  .filter((l) => l.group === g)
                  .map((l) => (
                    <option key={l.slug} value={l.slug}>
                      {l.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        <Field id="a-founded" label="Founded" optional error={errors.foundedYear?.message}>
          <Input
            inputMode="numeric"
            {...register("foundedYear")}
            {...a11yProps("a-founded", errors.foundedYear?.message)}
          />
        </Field>
        <Field id="a-team" label="Team size" optional>
          <select {...register("teamSize")} id="a-team" className={selectClasses}>
            <option value="">Not set</option>
            {TEAM_SIZES.map((t) => (
              <option key={t} value={t}>
                {t} people
              </option>
            ))}
          </select>
        </Field>
        <Field id="a-languages" label="Languages" optional error={errors.languages?.message}>
          <Input
            placeholder="English, Spanish"
            {...register("languages")}
            {...a11yProps("a-languages", errors.languages?.message)}
          />
        </Field>
      </div>
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
          {isSubmitting ? "Saving…" : id ? "Save details" : "Create draft agency"}
        </Button>
      </div>
    </form>
  );
}
