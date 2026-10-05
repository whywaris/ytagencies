"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { slug: string; label: string };

type HeroSearchProps = {
  services: Option[];
  industries: Option[];
  defaultService: string;
  defaultIndustry: string;
};

// DESIGN.md "one memorable element": the sentence is the search. The button is a real link, so the
// default combo is crawlable and works before hydration.
export function HeroSearch({
  services,
  industries,
  defaultService,
  defaultIndustry,
}: HeroSearchProps) {
  const [service, setService] = useState(defaultService);
  const [industry, setIndustry] = useState(defaultIndustry);
  // Explicit labels: Radix only knows an item's text after the menu mounts, so without these
  // the server HTML (what crawlers and pre-hydration visitors see) would show empty selects.
  const serviceLabel = services.find((s) => s.slug === service)?.label;
  const industryLabel = industries.find((i) => i.slug === industry)?.label;

  return (
    <div role="search" aria-label="Find agencies" className="flex flex-col items-center gap-10">
      <p className="text-display text-balance">
        I need a YouTube{" "}
        <Select value={service} onValueChange={setService}>
          <SelectTrigger variant="inline" aria-label="Service">
            <SelectValue>{serviceLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {services.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>{" "}
        agency for{" "}
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger variant="inline" aria-label="Industry">
            <SelectValue>{industryLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {industries.map((i) => (
              <SelectItem key={i.slug} value={i.slug}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </p>
      <Button asChild>
        <Link href={`/${service}/for-${industry}`}>Find agencies</Link>
      </Button>
    </div>
  );
}
