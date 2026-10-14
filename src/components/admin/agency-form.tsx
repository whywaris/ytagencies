"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { SeoFields } from "@/components/admin/seo-fields";
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
    control,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<AgencyInput>({ resolver: zodResolver(agencySchema), defaultValues: defaults });
  const [seoTitle, seoDescription, name, tagline, slug, logo] = useWatch({
    control,
    name: ["seoTitle", "seoDescription", "name", "tagline", "slug", "logo"],
  });

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
      <Field id="a-logo" label="Logo" optional error={errors.logo?.message}>
        <Input
          type="url"
          inputMode="url"
          placeholder="https://media.ytagencies.com/logos/agency.png"
          {...register("logo")}
          {...a11yProps("a-logo", errors.logo?.message)}
        />
      </Field>
      <LogoPreview
        src={logo}
        name={name}
        onRemove={() => setValue("logo", "", { shouldDirty: true })}
      />
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
      <fieldset className="flex max-w-[640px] flex-col gap-4">
        <legend className="mb-1 font-medium">Search appearance</legend>
        <SeoFields
          title={seoTitle}
          description={seoDescription}
          onTitle={(v) => setValue("seoTitle", v, { shouldDirty: true })}
          onDescription={(v) => setValue("seoDescription", v, { shouldDirty: true })}
          shownTitle={seoTitle || `${name || "Agency"}: YouTube agency | YT Agencies`}
          shownDescription={seoDescription || tagline}
          breadcrumb={`ytagencies.com › agency › ${slug || "agency"}`}
          titleHint="Empty uses the generated title. Only admins can set this."
          descriptionHint="Empty uses the generated description."
          titleError={errors.seoTitle?.message}
          descriptionError={errors.seoDescription?.message}
        />
      </fieldset>

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

/**
 * The logo link on a light and a dark tile, as it'll look on the site (square, rounded). A plain
 * <img>: the link may not be saved (or allowed) yet, so next/image can't load it.
 */
function LogoPreview({ src, name, onRemove }: { src: string; name: string; onRemove: () => void }) {
  const [broken, setBroken] = useState<string | null>(null);
  const link = src.trim();
  if (!link) {
    return (
      <p className="-mt-4 text-small">
        A PNG, WebP or JPG on the media host, square, up to 1 MB. Without one, the initials show.
      </p>
    );
  }
  return (
    <div className="-mt-2 flex flex-wrap items-center gap-4">
      {[
        { bg: "bg-white border-[#d2d2d7]", label: "On light" },
        { bg: "bg-[#0b0c10] border-[#38383a]", label: "On dark" },
      ].map((t) => (
        <span key={t.label} className={`grid size-20 place-items-center rounded-lg border ${t.bg}`}>
          {broken === link ? (
            <span className="px-1 text-center text-[11px] text-[#888]">Can&apos;t load</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of an unsaved link
            <img
              src={link}
              alt={`${name || "Agency"} logo preview, ${t.label.toLowerCase()}`}
              width={56}
              height={56}
              onError={() => setBroken(link)}
              className="size-14 rounded-sm object-cover"
            />
          )}
        </span>
      ))}
      <button
        type="button"
        onClick={onRemove}
        className="min-h-11 text-destructive hover:underline"
      >
        Remove logo
      </button>
    </div>
  );
}
