"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import type { HeroTab } from "@/lib/data/hero";
import { cn } from "@/lib/utils";

// Home hero product window: service tabs (segmented control) over three real agencies. All tabs
// arrive from the server; switching only swaps what's shown, with a short crossfade.

const LOGO_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/agency-media/`;
const FADE_MS = 140;
const subscribers = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function HeroWindow({ tabs, domain }: { tabs: HeroTab[]; domain: string }) {
  const [active, setActive] = useState(0);
  const [dim, setDim] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const tab = tabs[active];

  const select = (i: number) => {
    if (i === active && !dim) return;
    clearTimeout(timer.current);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setActive(i);
    setDim(true);
    timer.current = setTimeout(() => {
      setActive(i);
      setDim(false);
    }, FADE_MS);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight"
        ? active === last
          ? 0
          : active + 1
        : e.key === "ArrowLeft"
          ? active === 0
            ? last
            : active - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
    select(next);
  };

  return (
    <div className="overflow-hidden rounded-[24px] border border-line bg-(--raised) text-left shadow-[0_1px_2px_rgba(20,25,40,.05),0_10px_24px_-6px_rgba(20,25,40,.08),0_40px_80px_-24px_rgba(20,25,40,.18)]">
      <div className="border-b border-line px-5 py-3.5">
        <span className="inline-flex max-w-full truncate rounded-full bg-(--track) px-3 py-1 text-[12px] text-text-2">
          {domain}
          {tab.path}
        </span>
      </div>

      <div className="flex flex-col gap-4 px-[22px] py-[18px]">
        <div
          role="tablist"
          aria-label="Services"
          onKeyDown={onKeyDown}
          className="-mx-1 flex w-fit max-w-[calc(100%+0.5rem)] [scrollbar-width:none] gap-1 overflow-x-auto rounded-full bg-(--track) p-1"
        >
          {tabs.map((t, i) => (
            <button
              key={t.serviceSlug}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`${id}-panel`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => select(i)}
              className={cn(
                "h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150",
                i === active
                  ? "bg-(--raised) text-text shadow-[0_1px_2px_rgba(20,25,40,.08),0_2px_6px_-2px_rgba(20,25,40,.12)]"
                  : "text-text-2 hover:text-text",
              )}
            >
              {t.serviceName}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${active}`}
          className={cn(
            "flex flex-col gap-4 transition-opacity duration-[140ms] ease-out",
            dim && "opacity-20",
          )}
        >
          <div className="flex items-baseline justify-between gap-4">
            <p className="min-w-0 text-[18px] leading-snug font-[650]">
              {tab.serviceName} agencies for {tab.industryName}
            </p>
            <Link href={tab.path} className="shrink-0 text-[13px] text-text-2 hover:text-text">
              {tab.count} {tab.count === 1 ? "agency" : "agencies"}
            </Link>
          </div>

          <ul className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 min-[860px]:grid-cols-3">
            {tab.agencies.map((a, i) => (
              <li key={a.slug} className={cn(i === 2 && "hidden min-[860px]:block")}>
                <AgencyCard agency={a} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AgencyCard({ agency: a }: { agency: HeroTab["agencies"][number] }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-[18px] border border-line bg-(--raised) p-[18px] transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-text-2">
      <div className="flex items-center gap-3">
        {a.logoPath ? (
          <Image
            src={LOGO_BASE + a.logoPath}
            alt={`${a.name} logo`}
            width={42}
            height={42}
            className="size-[42px] shrink-0 rounded-[12px] border border-line object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-[42px] shrink-0 items-center justify-center rounded-[12px] bg-(--accent-soft) text-[15px] font-semibold text-(--accent-on-soft)"
          >
            {a.initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-[650]">{a.name}</p>
          {a.meta && <p className="truncate text-[13px] text-text-2">{a.meta}</p>}
        </div>
      </div>

      {a.isVerified && (
        <span className="inline-flex items-center gap-1 self-start rounded-full bg-(--mint-soft) px-2 py-0.5 text-[12px] font-semibold text-(--mint)">
          <Check className="size-3 [stroke-width:2.5]" aria-hidden />
          Verified
        </span>
      )}

      {/* Fixed height, so switching tabs doesn't make the window jump. */}
      <div className="min-h-[60px]">
        {a.channels.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] text-text-2">Channels they&apos;ve worked on</p>
            <ul className="flex flex-col gap-1 text-[13px]">
              {a.channels.map((c) => (
                <li key={c.title} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">{c.title}</span>
                  {c.subscribers !== null && (
                    <span className="shrink-0 text-text-2 tabular-nums">
                      {subscribers.format(c.subscribers)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          a.industries.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {a.industries.map((name) => (
                <li
                  key={name}
                  className="rounded-full bg-(--track) px-2.5 py-1 text-[12px] text-text-2"
                >
                  {name}
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px]">
        {a.price ? (
          <span className="text-text-2">
            from <b className="font-semibold text-text">{a.price.amount}</b>
            {a.price.suffix}
          </span>
        ) : (
          <span className="text-text-2">Price on request</span>
        )}
        <Link href={`/agency/${a.slug}`} className="font-medium text-accent hover:underline">
          View<span className="sr-only"> {a.name}</span>
        </Link>
      </div>
    </article>
  );
}
