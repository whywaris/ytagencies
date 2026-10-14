"use client";

import { ArrowRight, Briefcase, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { finderHref, type ComboCounts } from "@/lib/home";
import { cn } from "@/lib/utils";

// Home hero finder: service + industry → the best page for that pair (lib/home.ts). The only
// client code on the home page, with the closing band's button that brings focus back here.

type Option = { slug: string; name: string };

export const FINDER_ID = "finder";
const SERVICE_ID = "finder-service";

const field =
  "flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 focus-within:outline-2 focus-within:outline-accent";
const select =
  "w-full min-w-0 cursor-pointer bg-raised text-[17px] font-medium text-text outline-none";
/** The open list is drawn by the browser: give each option the theme's colours, or Windows shows
 * light text on a white list in dark mode. */
const option = "bg-raised text-text";

export function Finder({
  services,
  industries,
  counts,
  minToIndex,
}: {
  services: Option[];
  industries: Option[];
  counts: ComboCounts;
  minToIndex: number;
}) {
  const router = useRouter();
  const [service, setService] = useState(services[0]?.slug ?? "");
  const [industry, setIndustry] = useState(industries[0]?.slug ?? "");

  return (
    <form
      id={FINDER_ID}
      role="search"
      aria-label="Find agencies"
      onSubmit={(e) => {
        e.preventDefault();
        if (service && industry) router.push(finderHref(service, industry, counts, minToIndex));
      }}
      className="flex w-full scroll-mt-24 flex-col gap-2 rounded-[28px] border border-line bg-raised p-2.5 shadow-[0_1px_2px_rgba(20,25,40,.05),0_24px_48px_-16px_rgba(31,94,255,.28)] md:flex-row md:items-center"
    >
      <label className={field}>
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"
        >
          <Briefcase className="size-5 [stroke-width:1.75]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col text-left">
          <span className="text-[13px] text-text-2">I need help with</span>
          <select
            id={SERVICE_ID}
            aria-label="I need help with"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className={select}
          >
            {services.map((s) => (
              <option key={s.slug} value={s.slug} className={option}>
                {s.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      <span aria-hidden className="hidden h-10 w-px bg-line md:block" />
      <label className={field}>
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--coral-soft) text-(--coral)"
        >
          <Store className="size-5 [stroke-width:1.75]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col text-left">
          <span className="text-[13px] text-text-2">For my business in</span>
          <select
            aria-label="For my business in"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className={select}
          >
            {industries.map((i) => (
              <option key={i.slug} value={i.slug} className={option}>
                {i.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      <button
        type="submit"
        className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-[20px] bg-accent px-7 text-[17px] font-semibold text-on-accent transition-colors duration-150 hover:bg-(--accent-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Find agencies
        <ArrowRight className="size-5 [stroke-width:2]" aria-hidden />
      </button>
    </form>
  );
}

/** Closing band button: scrolls back to the hero finder and focuses its first field. */
export function FindAgenciesButton({ className }: { className?: string }) {
  return (
    <a
      href={`#${FINDER_ID}`}
      onClick={(e) => {
        const el = document.getElementById(SERVICE_ID);
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "center",
        });
        el.focus({ preventScroll: true });
      }}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-[#16171a] transition-transform duration-150 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        className,
      )}
    >
      Find agencies
      <ArrowRight className="size-5 [stroke-width:2]" aria-hidden />
    </a>
  );
}
