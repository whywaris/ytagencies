"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";

type Option = { slug: string; label: string };

type HeroSearchProps = {
  services: Option[];
  industries: Option[];
  defaultService: string;
  defaultIndustry: string;
};

/**
 * A native <select> that reads as a large underlined word in the sentence (DESIGN.md hero).
 * Native, so keyboard, screen readers and mobile pickers work with no library JS.
 * A native select is as wide as its longest option, so the visible word is a plain span that sets
 * the width, and the real select sits transparently on top of it (clicks and keys hit the select).
 * The focus ring is drawn on the wrapper, since the select itself is transparent.
 */
function InlineSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const current = options.find((o) => o.slug === value)?.label ?? "";
  return (
    <span className="relative inline-flex items-baseline gap-[0.12em] border-b-[0.06em] border-current font-semibold whitespace-nowrap text-accent outline-offset-4 transition-colors duration-150 ease-out hover:text-accent/80 has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-accent">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span aria-hidden>{current}</span>
      <ChevronDownIcon aria-hidden className="size-[0.5em] shrink-0 self-center" />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer appearance-none text-[17px] opacity-0 outline-none"
      >
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

// DESIGN.md "one memorable element": the sentence is the search. The button is a real link, so the
// default combination is crawlable and works before hydration.
export function HeroSearch({
  services,
  industries,
  defaultService,
  defaultIndustry,
}: HeroSearchProps) {
  const [service, setService] = useState(defaultService);
  const [industry, setIndustry] = useState(defaultIndustry);

  return (
    <div role="search" aria-label="Find agencies" className="flex flex-col items-center gap-10">
      <p className="text-display text-balance">
        I need a YouTube{" "}
        <InlineSelect label="Service" value={service} options={services} onChange={setService} />{" "}
        agency for{" "}
        <InlineSelect
          label="Industry"
          value={industry}
          options={industries}
          onChange={setIndustry}
        />
      </p>
      <Button asChild>
        <Link href={`/${service}/for-${industry}`}>Find agencies</Link>
      </Button>
    </div>
  );
}
