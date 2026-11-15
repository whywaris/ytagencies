import { BookOpen, Maximize, RotateCcw, Search, SkipForward } from "lucide-react";
import Link from "next/link";

import { NotFoundTracker } from "@/components/not-found-tracker";
import { getLiveGuides } from "@/lib/data/guides";
import { CONTACT_EMAIL, SITE_DOMAIN } from "@/lib/site";
import { cn } from "@/lib/utils";

// The public 404 (app/not-found.tsx and (marketing)/not-found.tsx). A decorative "video player"
// whose "watch next" row is the three newest guides. The player is dark in both
// themes, with fixed colours chosen for contrast on #0E1116 (white on its tiles passes AA).
// No YouTube logo, red or branding.

const TILE_BG = ["bg-[#1F5EFF]", "bg-[#C2410C]", "bg-[#0B7A5A]"];

export async function NotFoundContent() {
  const cards = (await getLiveGuides()).slice(0, 3).map((g, i) => ({
    href: `/guides/${g.slug}`,
    tile: TILE_BG[i],
    icon: BookOpen,
    tag: undefined as string | undefined,
    title: g.title,
    text: g.excerpt ?? "",
  }));

  return (
    <>
      <NotFoundTracker />
      <section className="px-4 pt-14 pb-12 text-center md:px-6 md:pt-20">
        <div className="mx-auto max-w-[820px]">
          <p className="inline-flex items-center rounded-full bg-(--coral-soft) px-3 py-1 font-mono text-[12.5px] font-medium text-(--coral-on-soft)">
            Error 404 · Page not found
          </p>
          <h1 className="mt-5 text-[clamp(36px,5.4vw,64px)] leading-[1.05] font-[650] tracking-[-0.035em] text-balance">
            This link went nowhere.
            <span className="block text-(--accent-on-soft)">The guides are still here.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[36em] text-[17px] text-text-2">
            The page was moved or removed. Search the guides, or start with the newest ones below.
          </p>
          <form
            action="/guides"
            method="get"
            role="search"
            className="mx-auto mt-8 flex max-w-[640px] flex-col gap-2 rounded-[20px] border border-line bg-raised p-1.5 text-left shadow-[0_1px_2px_rgba(20,25,40,.05),0_12px_32px_-12px_rgba(20,25,40,.16)] focus-within:border-accent sm:flex-row sm:rounded-full"
          >
            <label htmlFor="nf-need" className="sr-only">
              Search the guides
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-4">
              <Search className="size-[18px] shrink-0 text-text-2" aria-hidden />
              <input
                id="nf-need"
                name="q"
                type="search"
                maxLength={200}
                placeholder="e.g. YouTube ads cost"
                className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-text-2"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-[15.5px] font-semibold whitespace-nowrap text-on-accent"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <section aria-label="Ways forward" className="px-4 pb-16 md:px-6">
        <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-[#0E1116] text-white shadow-[0_30px_80px_-30px_rgba(14,17,22,.55)]">
          <div className="flex items-center gap-3 px-5 pt-5 md:px-7">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#1F5EFF] text-[13px] font-bold"
            >
              YT
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">The page you were looking for</p>
              <p className="truncate text-[13px] text-[#A0A4AD]">
                {SITE_DOMAIN} · no longer available
              </p>
            </div>
          </div>

          <div
            role="img"
            aria-label="404"
            className="flex items-center justify-center gap-[clamp(8px,2vw,28px)] py-10 text-[clamp(110px,17vw,230px)] leading-none font-bold tracking-[-0.04em] md:py-14"
          >
            <span aria-hidden className="text-[#6B9BFF]">
              4
            </span>
            <Link
              href="/"
              aria-label="Back to home"
              className="nf-replay grid size-[clamp(96px,14vw,190px)] shrink-0 place-items-center rounded-full bg-[#E5533A] outline-none focus-visible:ring-4 focus-visible:ring-white/70"
            >
              <RotateCcw
                className="nf-replay-icon size-[38%] [stroke-width:2.2] text-white"
                aria-hidden
              />
            </Link>
            <span aria-hidden className="text-[#3CCB9C]">
              4
            </span>
          </div>

          <div className="px-5 md:px-7">
            <p className="text-[13px] font-semibold tracking-wide text-[#A0A4AD] uppercase">
              Watch next
            </p>
            <ul className="mt-3 grid [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] gap-3">
              {cards.map((c, i) => (
                <li key={c.title} className="nf-rise" style={{ animationDelay: `${i * 120}ms` }}>
                  <Link
                    href={c.href}
                    className="group flex h-full flex-col gap-3 rounded-2xl bg-[#161A21] p-3 transition-colors duration-150 outline-none hover:bg-[#20252F] focus-visible:ring-2 focus-visible:ring-white/70"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "relative grid aspect-[16/8] place-items-center rounded-xl text-white",
                        c.tile,
                      )}
                    >
                      <c.icon className="size-9 [stroke-width:1.8]" />
                      {c.tag && (
                        <span className="absolute top-2 left-2 rounded-full bg-[#0E1116]/70 px-2 py-0.5 text-[11.5px] font-semibold">
                          {c.tag}
                        </span>
                      )}
                    </span>
                    <span className="px-1 pb-1">
                      <b className="block text-[15.5px] font-semibold">{c.title}</b>
                      <span className="text-[13.5px] text-[#A0A4AD]">{c.text}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div aria-hidden className="px-5 pt-6 pb-5 md:px-7">
            <div className="relative h-1.5 rounded-full bg-[#E5533A]">
              <span className="nf-knob absolute top-1/2 right-0 size-3.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            </div>
            <div className="mt-4 flex items-center gap-4 text-[#C9CCD2]">
              <RotateCcw className="size-5" />
              <SkipForward className="size-5" />
              <span className="font-mono text-[13px] tabular-nums">4:04 / 4:04</span>
              <span className="ml-auto rounded border border-[#C9CCD2]/60 px-1 text-[11px] font-semibold">
                CC
              </span>
              <Maximize className="size-5" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface px-4 py-14 md:px-6">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-center text-[15px] text-text-2">
            Still stuck? Email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold text-accent hover:underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and tell us what you were looking for.
          </p>
        </div>
      </section>
    </>
  );
}
