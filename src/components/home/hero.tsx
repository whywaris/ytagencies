import { Check, Layers, Wallet } from "lucide-react";
import Link from "next/link";

import { HeroWindow } from "@/components/home/hero-window";
import { getHeroTabs } from "@/lib/data/hero";
import { SITE_DOMAIN } from "@/lib/site";

// Home hero: headline, actions, proof row and a product window with real directory data.
// Server component; the window's tabs are the only client code.

const PROOF = ["Free for businesses", "Prices shown before you call", "No fees, no middleman"];

// Callouts straddle the window's top (left card) and bottom (right card) edges and sit as far
// outside it as the screen allows (up to 210px), so they only overlap the window's chrome and
// padding, never the tabs or the agency cards.
const callout =
  "hero-pop absolute z-10 hidden max-w-[250px] items-start gap-3 rounded-[16px] border border-line bg-(--raised) p-3.5 text-left shadow-[0_1px_2px_rgba(20,25,40,.06),0_12px_32px_-8px_rgba(20,25,40,.18)] min-[820px]:flex";

export async function HomeHero() {
  const tabs = await getHeroTabs();

  return (
    <section className="home-hero relative isolate overflow-hidden px-4 pt-10 pb-14 md:px-6 md:pt-14 md:pb-18">
      <div
        aria-hidden
        className="home-hero-glow pointer-events-none absolute [inset:-10%_-10%_30%_-10%] -z-10 blur-[60px]"
      />

      <div className="mx-auto flex max-w-content flex-col items-center text-center">
        <h1 className="max-w-[15em] text-[clamp(34px,4.6vw,56px)] leading-[1.05] font-[650] tracking-[-0.035em] text-balance">
          Stop wasting money on YouTube agencies that don&apos;t deliver
        </h1>
        <p className="mt-4 max-w-[34em] text-[18px] leading-[1.5] text-text-2">
          Find agencies that{" "}
          <strong className="font-semibold text-text">already work in your industry</strong>. See
          their real channels and prices before you talk to anyone.
        </p>

        <div className="mt-7 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/get-matched"
            className="flex h-12 items-center justify-center rounded-full bg-accent px-6 font-semibold text-on-accent shadow-[0_1px_2px_rgba(31,94,255,.3),0_8px_20px_-6px_rgba(31,94,255,.45)] transition-transform duration-150 ease-out hover:-translate-y-px"
          >
            Find my agency
          </Link>
          <Link
            href="#services"
            className="flex h-12 items-center justify-center rounded-full border border-line bg-(--raised) px-6 font-semibold transition-colors duration-150 ease-out hover:border-text-2"
          >
            Browse agencies
          </Link>
        </div>

        <ul className="mt-[18px] flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14px] text-text-2">
          {PROOF.map((p) => (
            <li key={p} className="flex items-center gap-1.5">
              <Check className="size-4 [stroke-width:2.25] text-(--mint)" aria-hidden />
              {p}
            </li>
          ))}
        </ul>

        {tabs.length > 0 && (
          <div className="hero-rise relative mt-12 w-full max-w-[980px]">
            <HeroWindow tabs={tabs} domain={SITE_DOMAIN} />

            <div
              className={`${callout} [animation-delay:.25s] max-[1139px]:-top-10 max-[1139px]:left-4 min-[1140px]:-top-[50px] min-[1140px]:left-[max(-210px,calc(16px_-_(100vw_-_980px)_/_2))]`}
            >
              <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] bg-(--amber-soft) text-(--amber)">
                <Wallet className="size-[18px] [stroke-width:1.75]" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[14px] font-semibold">Budget up front</span>
                <span className="text-[13px] leading-snug text-text-2">
                  See each agency&apos;s starting price before you reach out.
                </span>
              </span>
            </div>

            <div
              className={`${callout} [animation-delay:.35s] max-[1139px]:!hidden min-[1140px]:right-[max(-210px,calc(16px_-_(100vw_-_980px)_/_2))] min-[1140px]:-bottom-11`}
            >
              <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] bg-(--mint-soft) text-(--mint)">
                <Layers className="size-[18px] [stroke-width:1.75]" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[14px] font-semibold">Industry specialists</span>
                <span className="text-[13px] leading-snug text-text-2">
                  Every agency lists the industries it works in.
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
