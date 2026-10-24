"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import { a11yProps, checkboxRow, Field, selectClasses } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Where an agency is based and who it serves, for the owner and admin profile forms. The city is
// typed by name with the country's known cities suggested (a native datalist); a new one is created
// when the profile is saved (lib/data/cities.ts). "Serves" lists countries the agency works with
// remotely: it appears there under its own heading, never as a local agency.

export type CountryOption = {
  slug: string;
  name: string;
  cities: { slug: string; name: string }[];
};

type PlaceForm = {
  hqCountry: string;
  hqCity: string;
  serves: string[];
  servesWorldwide: boolean;
};

export function LocationFields({
  form,
  countries,
  idPrefix,
}: {
  form: UseFormReturn<PlaceForm>;
  countries: CountryOption[];
  idPrefix: string;
}) {
  const { register, control, setValue, formState } = form;
  const errors = formState.errors;
  const hqCountry = useWatch({ control, name: "hqCountry" });
  const cities = countries.find((c) => c.slug === hqCountry)?.cities ?? [];
  const listId = `${idPrefix}-cities`;

  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="mb-1 text-[15px] font-semibold">Where you&apos;re based</legend>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={`${idPrefix}-hq-country`}
          label="Country"
          optional
          error={errors.hqCountry?.message}
        >
          <select
            {...register("hqCountry", {
              // A city from another country no longer fits.
              onChange: () => setValue("hqCity", ""),
            })}
            {...a11yProps(`${idPrefix}-hq-country`, errors.hqCountry?.message)}
            className={selectClasses}
          >
            <option value="">Not set</option>
            {countries.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${idPrefix}-hq-city`} label="City" optional error={errors.hqCity?.message}>
          <Input
            list={listId}
            autoComplete="address-level2"
            maxLength={80}
            disabled={!hqCountry}
            placeholder={hqCountry ? "Start typing your city" : "Choose a country first"}
            {...register("hqCity")}
            {...a11yProps(`${idPrefix}-hq-city`, errors.hqCity?.message)}
          />
          <datalist id={listId}>
            {cities.map((c) => (
              <option key={c.slug} value={c.name} />
            ))}
          </datalist>
        </Field>
      </div>

      <label className={cn(checkboxRow, "self-start")}>
        <input type="checkbox" {...register("servesWorldwide")} />
        We serve clients worldwide, remotely
      </label>

      <Field
        id={`${idPrefix}-serves`}
        label="Countries you also serve remotely"
        optional
        error={errors.serves?.message}
      >
        <p id={`${idPrefix}-serves-hint`} className="-mt-1 text-small">
          Hold Ctrl (Cmd on a Mac) to pick several. You&apos;re listed on their pages as an agency
          that serves them remotely, never as a local one.
        </p>
        <select
          multiple
          size={8}
          {...register("serves")}
          {...a11yProps(`${idPrefix}-serves`, errors.serves?.message)}
          aria-describedby={`${idPrefix}-serves-hint`}
          className={cn(selectClasses, "h-auto py-2")}
        >
          {countries
            .filter((c) => c.slug !== hqCountry)
            .map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
        </select>
      </Field>
    </fieldset>
  );
}
