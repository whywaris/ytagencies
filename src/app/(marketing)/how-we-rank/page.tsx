import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  FileText,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { MAX_SPONSORED, RANKING_UPDATED } from "@/lib/ranking";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, MIN_AGENCIES_TO_INDEX } from "@/lib/site";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

// Public explanation of lib/ranking.ts (ADMIN_V2_SPEC §6). Change both together, and bump
// RANKING_UPDATED there when the rules change.

const TITLE = `How we rank agencies | ${BRAND_NAME}`;
const DESCRIPTION =
  "How YT Agencies orders agencies on directory pages: sponsored placements, then Verified agencies, then everyone else, each sorted by profile quality, reviews, verification and reply time.";

export const metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/how-we-rank",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "How we rank agencies", path: "/how-we-rank" },
];

const shell = "mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14";
const h2 = "text-[clamp(28px,3.4vw,42px)] leading-[1.1] font-[650] tracking-[-0.03em] text-balance";
const eyebrow = "text-[13px] font-semibold tracking-[0.08em] text-accent uppercase";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const pill = cn(
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-raised px-4 text-[15px] font-medium hover:border-text-2",
  focusRing,
);

// ───────── Hero illustration (decorative) ─────────

const ROWS = [
  { i: "NV", name: "Northvale Media", score: 92 },
  { i: "BK", name: "Brightkey Studio", score: 81 },
  { i: "LR", name: "Loop & Reel", score: 67 },
];

function RankCard() {
  return (
    <div
      aria-hidden
      className="w-full max-w-[460px] rounded-[22px] border border-line bg-raised p-5 shadow-[0_24px_48px_-24px_rgba(20,25,40,.25)]"
    >
      <p className="text-[15px] font-semibold">YouTube Ads agencies for Dentists</p>
      <p className="text-[13px] text-text-2">Sorted by quality score</p>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-(--amber) bg-(--amber-soft) p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-raised text-[12px] font-semibold">
          SP
        </span>
        <span className="flex-1 text-[14px] font-medium">Spotlight Ads</span>
        <span className="rounded-full border border-(--amber) px-2 py-0.5 text-[11.5px] font-semibold text-(--amber-on-soft)">
          Sponsored
        </span>
      </div>
      <div className="my-4 flex items-center gap-3 text-[11px] font-semibold tracking-[0.1em] text-text-2">
        <span className="h-px flex-1 bg-line" />
        EARNED BY MERIT
        <span className="h-px flex-1 bg-line" />
      </div>
      <ol className="flex flex-col gap-3">
        {ROWS.map((r, n) => (
          <li key={r.i} className="flex items-center gap-3">
            <span className="w-4 font-mono text-[13px] text-text-2">{n + 1}</span>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-[12px] font-semibold">
              {r.i}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="truncate text-[14px] font-medium">{r.name}</span>
              <span className="h-1.5 rounded-full bg-surface">
                <span
                  className="grow-x block h-full rounded-full bg-accent"
                  style={{ width: `${r.score}%`, animationDelay: `${0.15 + n * 0.12}s` }}
                />
              </span>
            </span>
            <span className="w-7 text-right font-mono text-[13px] font-semibold">{r.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ───────── Content ─────────

const GROUPS = [
  {
    n: 1,
    title: `Sponsored, up to ${MAX_SPONSORED}`,
    body: "Paid spots for Pro agencies with the Verified badge, in slot order. Always labelled Sponsored.",
    tone: "border-(--amber) bg-(--amber-soft)",
    num: "bg-(--amber) text-bg",
  },
  {
    n: 2,
    title: "Verified agencies",
    body: "Agencies that passed our checks, on any plan, free included. Sorted by quality score.",
    tone: "border-verified/40 bg-(--mint-soft)",
    num: "bg-verified text-bg",
  },
  {
    n: 3,
    title: "Everyone else",
    body: "All other agencies, Pro or free, sorted by quality score. Ties are listed alphabetically.",
    tone: "border-line bg-surface",
    num: "bg-text text-bg",
  },
];

const PARTS = [
  { label: "Profile", points: 36, bar: "bg-accent" },
  { label: "Reviews", points: 27, bar: "bg-(--violet)" },
  { label: "Verified", points: 27, bar: "bg-verified" },
  { label: "Response", points: 10, bar: "bg-(--coral)" },
];

const SCORE_CARDS: {
  title: string;
  points: number;
  Icon: LucideIcon;
  tint: string;
  body: React.ReactNode;
}[] = [
  {
    title: "Complete profile",
    points: 36,
    Icon: FileText,
    tint: "bg-accent-soft text-accent",
    body: (
      <ul className="flex flex-col gap-1">
        <li>Logo: 5</li>
        <li>Tagline: 5</li>
        <li>Description: 10 for 200 characters or more, 5 for at least 50</li>
        <li>Starting price: 5</li>
        <li>At least one case study: 10</li>
        <li>At least one location: 5</li>
      </ul>
    ),
  },
  {
    title: "Reviews",
    points: 27,
    Icon: Star,
    tint: "bg-(--violet-soft) text-(--violet)",
    body: (
      <p>
        Only reviews we&apos;ve checked and published count: 1.5 points per review, up to 10
        reviews, plus up to 15 points for the average rating.
      </p>
    ),
  },
  {
    title: "Verification",
    points: 27,
    Icon: BadgeCheck,
    tint: "bg-(--mint-soft) text-(--mint)",
    body: (
      <p>
        30 points when we&apos;ve verified the agency and checked its YouTube channel stats, 15 when
        it was verified before channel stats were recorded. Channel stats are re-checked every
        month.
      </p>
    ),
  },
  {
    title: "Response time",
    points: 10,
    Icon: Clock,
    tint: "bg-(--coral-soft) text-(--coral)",
    body: (
      <p>
        Agencies mark each inquiry as contacted in their dashboard. We take the median time over the
        last 90 days, once an agency has at least 3 contacted inquiries: 10 points for under 4
        hours, 7 for under a day, 4 for under 2 days.
      </p>
    ),
  },
];

const NOT_FOR_SALE = [
  "A higher place by paying for Pro",
  "The Verified badge",
  "Reviews, or which reviews are shown",
  "A better score for claiming a listing or getting more inquiries",
];

const OWNERS = [
  "The order reflects how complete, reviewed and verified an agency is, not what it pays us.",
  "Anything paid is labelled Sponsored, so you always know what you're looking at.",
  "Verified badges mean we've checked the agency's website, business and YouTube channels.",
];

const STEPS = [
  {
    n: "01",
    title: "Complete your profile",
    body: "Logo, tagline, a real description, a starting price, a location and at least one case study.",
  },
  {
    n: "02",
    title: "Ask clients for reviews",
    body: "Every checked, published review adds points, and so does a strong average.",
  },
  {
    n: "03",
    title: "Apply for Verified",
    body: "Verified agencies are listed above everyone else who isn't sponsored. It's free to apply.",
  },
  {
    n: "04",
    title: "Reply fast, mark it contacted",
    body: "Once you have 3 contacted inquiries in 90 days, fast replies earn up to 10 points.",
  },
];

const updatedText = new Date(`${RANKING_UPDATED}T00:00:00Z`).toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default function HowWeRankPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <JsonLd
        data={webPageJsonLd({
          name: "How we rank agencies",
          description: DESCRIPTION,
          path: "/how-we-rank",
          updated: RANKING_UPDATED,
        })}
      />

      {/* a) Hero */}
      <section className="home-grid overflow-clip px-4 pt-8 pb-10 md:px-6 md:pb-14">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div className="flex flex-col gap-6">
            <Breadcrumbs items={breadcrumbs} />
            <h1 className="text-[clamp(40px,5.6vw,68px)] leading-[1.02] font-[680] tracking-[-0.045em]">
              Ranked on merit.
              <br />
              <span className="text-accent">Not money.</span>
            </h1>
            <p className="max-w-[34em] text-[clamp(17px,1.6vw,19px)] leading-normal text-text-2">
              Agencies earn their place with a complete profile, checked reviews, verification and
              fast replies. The only paid spots are labelled Sponsored.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#owners" className={pill}>
                For business owners: what this means
              </a>
              <a href="#agencies" className={pill}>
                For agencies: how to move up
              </a>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <RankCard />
          </div>
        </div>
      </section>

      {/* b) The order */}
      <section aria-labelledby="order-heading">
        <div className={cn(shell, "flex flex-col gap-10")}>
          <div className="flex max-w-[680px] flex-col gap-3">
            <p className={eyebrow}>The order on every page</p>
            <h2 id="order-heading" className={h2}>
              Three groups. Same on every page.
            </h2>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {GROUPS.map((g) => (
              <li key={g.n} className={cn("flex flex-col gap-3 rounded-[22px] border p-6", g.tone)}>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-9 place-items-center rounded-full font-mono font-semibold",
                    g.num,
                  )}
                >
                  {g.n}
                </span>
                <h3 className="text-[19px] font-[650]">{g.title}</h3>
                <p className="text-[15.5px] text-text-2">{g.body}</p>
              </li>
            ))}
          </ol>
          <p className="max-w-[60ch] text-[15.5px] text-text-2">
            Paying for Pro doesn&apos;t change the order. Pro is how an agency manages its profile
            and receives inquiries.
          </p>
        </div>
      </section>

      {/* c) The quality score */}
      <section aria-labelledby="score-heading">
        <div className={cn(shell, "flex flex-col gap-10")}>
          <div className="flex max-w-[680px] flex-col gap-3">
            <p className={eyebrow}>The quality score</p>
            <h2 id="score-heading" className={h2}>
              100 points, all of them earned
            </h2>
            <p className="text-[17px] text-text-2">
              Four things decide an agency&apos;s place. None of them can be bought.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div
              role="img"
              aria-label="Quality score out of 100: profile 36 points, reviews 27, verification 27, response time 10."
              className="flex h-4 overflow-hidden rounded-full"
            >
              {PARTS.map((p) => (
                <span key={p.label} className={p.bar} style={{ width: `${p.points}%` }} />
              ))}
            </div>
            <ul aria-hidden className="flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-text-2">
              {PARTS.map((p) => (
                <li key={p.label} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-full", p.bar)} />
                  {p.label} <span className="font-mono text-text">{p.points}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {SCORE_CARDS.map(({ title, points, Icon, tint, body }) => (
              <li
                key={title}
                className="flex flex-col gap-3 rounded-[22px] border border-line bg-raised p-6"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn("grid size-10 place-items-center rounded-xl", tint)}
                  >
                    <Icon className="size-5 [stroke-width:1.75]" />
                  </span>
                  <h3 className="flex-1 text-[18px] font-[650]">{title}</h3>
                  <span className="font-mono text-[15px] font-semibold">
                    up to {points} <span className="text-text-2">pts</span>
                  </span>
                </div>
                <div className="text-[15px] text-text-2">{body}</div>
              </li>
            ))}
          </ul>
          <p className="max-w-[70ch] text-[15px] text-text-2">
            The profile, review and verification points above are scaled by 0.9, so together they
            make up 90. Response time needs at least 3 contacted inquiries in 90 days. Agencies
            without that data (free listings can&apos;t receive inquiries, so it&apos;s always true
            for them) are scored on the other 90 points, scaled to 100, so nobody loses out for a
            number they can&apos;t have. Scores are rounded to a whole number.
          </p>
        </div>
      </section>

      {/* d) What money can't buy */}
      <section aria-labelledby="money-heading" className={shell}>
        <div className="flex flex-col gap-8 rounded-[28px] bg-[#16171a] px-6 py-12 text-white md:px-12 md:py-14 site-dark:border site-dark:border-line site-dark:bg-raised">
          <h2 id="money-heading" className={h2}>
            What money can&apos;t buy here
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {NOT_FOR_SALE.map((t) => (
              <li key={t} className="flex items-start gap-3 text-[16.5px]">
                <X
                  className="mt-0.5 size-5 shrink-0 [stroke-width:2.5] text-[#ff8a6e]"
                  aria-label="Not for sale:"
                />
                {t}
              </li>
            ))}
          </ul>
          <p className="text-[17px] text-white/75">
            The only paid way up is a Sponsored spot, and it&apos;s always labelled.
          </p>
        </div>
      </section>

      {/* e) Owners / agencies */}
      <section aria-label="What this means" className={shell}>
        <div className="grid gap-4 md:grid-cols-2">
          <div
            id="owners"
            className="flex scroll-mt-20 flex-col gap-5 rounded-[22px] border border-line bg-raised p-7"
          >
            <div className="flex flex-col gap-2">
              <p className={eyebrow}>For business owners</p>
              <h2 className="text-[26px] leading-tight font-[650] tracking-[-0.02em]">
                What this means for you
              </h2>
            </div>
            <ul className="flex flex-col gap-3">
              {OWNERS.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15.5px]">
                  <Check
                    className="mt-0.5 size-5 shrink-0 [stroke-width:2.5] text-verified"
                    aria-hidden
                  />
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href="/#finder"
              className={cn(
                "mt-auto inline-flex h-12 items-center gap-2 self-start rounded-full bg-accent px-6 font-semibold text-on-accent hover:bg-(--accent-hover)",
                focusRing,
              )}
            >
              Find agencies
              <ArrowRight className="size-5 [stroke-width:2]" aria-hidden />
            </Link>
          </div>
          <div
            id="agencies"
            className="flex scroll-mt-20 flex-col gap-5 rounded-[22px] border border-line bg-raised p-7"
          >
            <div className="flex flex-col gap-2">
              <p className={eyebrow}>For agencies</p>
              <h2 className="text-[26px] leading-tight font-[650] tracking-[-0.02em]">
                How to move up
              </h2>
            </div>
            <ol className="flex flex-col gap-4">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-4">
                  <span className="font-mono text-[15px] font-semibold text-accent">{s.n}</span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">{s.title}</span>
                    <span className="text-[15px] text-text-2">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Link
              href="/list-your-agency#claim"
              className={cn(
                "mt-auto inline-flex h-12 items-center gap-2 self-start rounded-full border border-line px-6 font-semibold hover:border-text-2",
                focusRing,
              )}
            >
              Claim your listing
              <ArrowRight className="size-5 [stroke-width:2]" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* f) Note */}
      <section aria-label="Notes" className={cn(shell, "pt-0 md:pt-0")}>
        <p className="max-w-[70ch] text-[14px] text-text-2">
          Directory pages need {MIN_AGENCIES_TO_INDEX} published agencies before search engines
          index them. What each plan includes is on our{" "}
          <Link href="/pricing" className={cn("rounded text-accent hover:underline", focusRing)}>
            pricing page
          </Link>
          . Last updated <time dateTime={RANKING_UPDATED}>{updatedText}</time>.
        </p>
      </section>
    </>
  );
}
