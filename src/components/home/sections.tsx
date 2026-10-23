import {
  ArrowRight,
  BadgeCheck,
  Bitcoin,
  Building2,
  ChartColumn,
  Check,
  ChevronDown,
  Clapperboard,
  Cloud,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  Home,
  Landmark,
  Megaphone,
  PenLine,
  MessageSquare,
  Play,
  Scale,
  Scissors,
  Search,
  ShoppingCart,
  Smartphone,
  Smile,
  Stethoscope,
  Target,
  Users,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { AgencyLogo } from "@/components/agency-logo";
import { GuideCard } from "@/components/guides/guide-parts";
import { FindAgenciesButton, Finder } from "@/components/home/finder";
import { JsonLd } from "@/components/json-ld";
import { getDirectoryIndex } from "@/lib/data/agencies";
import { getLiveGuides } from "@/lib/data/guides";
import { getHomeAgencies } from "@/lib/data/home";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { firstSentence, formatUsd } from "@/lib/directory";
import { popularIndustryCombos, type ComboCounts } from "@/lib/home";
import { faqJsonLd } from "@/lib/seo/json-ld";
import { BRAND_NAME, INDEPENDENT_DIRECTORY, MIN_AGENCIES_TO_INDEX } from "@/lib/site";
import { cn } from "@/lib/utils";

// Home page sections. Server components with real data only: anything without data is left out,
// and a section with nothing to show isn't rendered. The finder is the only client code.

/** ~112px between sections on desktop (56 + 56), less on mobile. */
const shell = "mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14";
const h2 = "text-[clamp(28px,3.4vw,42px)] leading-[1.1] font-[650] tracking-[-0.03em] text-balance";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function SectionHeader({
  id,
  eyebrow,
  title,
  lede,
  link,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="flex max-w-[680px] min-w-0 flex-[1_1_480px] flex-col gap-3">
        <p className="text-[13px] font-semibold tracking-[0.08em] text-accent uppercase">
          {eyebrow}
        </p>
        <h2 id={id} className={h2}>
          {title}
        </h2>
        {lede && <p className="text-[17px] text-text-2">{lede}</p>}
      </div>
      {link && (
        <Link
          href={link.href}
          className={cn(
            "flex min-h-11 items-center gap-1 rounded font-medium text-accent hover:underline",
            focusRing,
          )}
        >
          {link.label}
          <ArrowRight className="size-4 [stroke-width:2]" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** Solid tile colours, one per service; the icon uses the page background so it stays visible
 * in both themes. */
const SOLID = {
  blue: "bg-accent",
  violet: "bg-(--violet)",
  mint: "bg-(--mint)",
  coral: "bg-(--coral)",
  amber: "bg-(--amber)",
  pink: "bg-(--pink)",
} as const;
type Tone = keyof typeof SOLID;
const SOFT: Record<Tone, string> = {
  blue: "bg-accent-soft text-accent",
  violet: "bg-(--violet-soft) text-(--violet)",
  mint: "bg-(--mint-soft) text-(--mint)",
  coral: "bg-(--coral-soft) text-(--coral)",
  amber: "bg-(--amber-soft) text-(--amber)",
  pink: "bg-(--pink-soft) text-(--pink)",
};
const TONE_ORDER: Tone[] = ["blue", "mint", "amber", "coral", "violet", "pink"];

/** Smartphone with a play mark: lucide has no single icon for it. */
function ShortsIcon({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <Smartphone className="size-full [stroke-width:1.75]" />
      <Play className="absolute inset-0 m-auto size-[38%] fill-current [stroke-width:0]" />
    </span>
  );
}

const SERVICE_CARDS: {
  slug: string;
  title: string;
  description: string;
  tone: Tone;
  Icon: LucideIcon | typeof ShortsIcon;
}[] = [
  {
    slug: "youtube-ads-agencies",
    title: "YouTube Ads",
    description: "Video ads that bring calls, leads and sales.",
    tone: "blue",
    Icon: Megaphone,
  },
  {
    slug: "youtube-seo-agencies",
    title: "YouTube SEO",
    description: "Get found when your customers search.",
    tone: "violet",
    Icon: Search,
  },
  {
    slug: "youtube-channel-management-agencies",
    title: "Channel management",
    description: "Strategy, uploads and monthly reporting.",
    tone: "mint",
    Icon: ChartColumn,
  },
  {
    slug: "youtube-video-production-agencies",
    title: "Video production",
    description: "Scripts, filming and editing that look the part.",
    tone: "coral",
    Icon: Video,
  },
  {
    slug: "youtube-shorts-agencies",
    title: "YouTube Shorts",
    description: "Short videos that reach new people fast.",
    tone: "amber",
    Icon: ShortsIcon,
  },
  {
    slug: "youtube-influencer-marketing-agencies",
    title: "Influencer marketing",
    description: "Partner with creators your buyers already watch.",
    tone: "pink",
    Icon: Users,
  },
  {
    slug: "youtube-video-editing-agencies",
    title: "Video editing",
    description: "Raw footage turned into videos people watch to the end.",
    tone: "blue",
    Icon: Scissors,
  },
  {
    slug: "youtube-scriptwriting-agencies",
    title: "Scriptwriting",
    description: "Hooks, outlines and scripts written for your audience.",
    tone: "violet",
    Icon: PenLine,
  },
];

const INDUSTRY_ICON: Record<string, LucideIcon> = {
  crypto: Bitcoin,
  doctors: Stethoscope,
  dentists: Smile,
  "real-estate": Home,
  saas: Cloud,
  ecommerce: ShoppingCart,
  coaches: Target,
  "law-firms": Scale,
  creators: Clapperboard,
  education: GraduationCap,
  finance: Landmark,
  fitness: Dumbbell,
  gaming: Gamepad2,
};

/** Shared lookups for the sections below. */
async function homeData() {
  const [services, industries, index] = await Promise.all([
    getServices(),
    getIndustries(),
    getDirectoryIndex(),
  ]);
  const serviceName = new Map(services.map((s) => [s.slug, s.name]));
  const industryBySegment = new Map(industries.map((i) => [`for-${i.slug}`, i]));
  return { services, industries, index, serviceName, industryBySegment };
}

// ───────── 2. Hero ─────────

const TRUST = [
  "Starting prices on every profile",
  "Filter by your industry",
  "Free for businesses and creators",
];

export async function HomeHero() {
  const { services, industries, index, serviceName, industryBySegment } = await homeData();
  const counts: ComboCounts = {};
  for (const [key, page] of index.pages) if (key.includes("|for-")) counts[key] = page.count;
  const popular = popularIndustryCombos(index.combos, 4).flatMap((c) => {
    const industry = industryBySegment.get(c.segment);
    const service = serviceName.get(c.serviceSlug);
    return industry && service
      ? [{ href: `/${c.serviceSlug}/${c.segment}`, label: `${service} for ${industry.name}` }]
      : [];
  });

  return (
    <section className="home-grid relative overflow-clip px-4 pt-14 pb-10 md:px-6 md:pt-20 md:pb-14">
      <div className="mx-auto flex max-w-[980px] flex-col items-center text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-raised py-1 pr-3.5 pl-1 text-[14px] font-medium">
          <span className="rounded-full bg-(--mint-soft) px-2.5 py-0.5 text-[13px] font-semibold text-(--mint)">
            Free
          </span>
          For businesses and creators
        </p>
        <h1 className="mt-6 max-w-[14em] text-[clamp(40px,6.2vw,76px)] leading-[1.02] font-[680] tracking-[-0.045em] text-balance">
          Compare YouTube agencies that already{" "}
          <span className="relative inline-block text-(--coral)">
            know your niche.
            <svg
              aria-hidden
              viewBox="0 0 300 16"
              preserveAspectRatio="none"
              className="absolute -bottom-[0.12em] left-0 h-[0.22em] w-full"
            >
              <path
                d="M3 11 C 60 4, 120 3, 175 7 S 260 13, 297 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>
        <p className="mt-6 max-w-[36em] text-[clamp(17px,1.6vw,20px)] leading-normal text-text-2">
          Free for businesses and creators. Compare specialists by service and starting price, and
          only talk to the ones you choose.
        </p>

        {services.length > 0 && industries.length > 0 && (
          <div className="mt-10 w-full max-w-[860px]">
            <Finder
              services={services.map((s) => ({ slug: s.slug, name: s.name }))}
              industries={industries.map((i) => ({ slug: i.slug, name: i.name }))}
              counts={counts}
              minToIndex={MIN_AGENCIES_TO_INDEX}
            />
          </div>
        )}

        {popular.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[14px]">
            <span className="text-text-2">Popular:</span>
            {popular.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border border-line bg-raised px-3.5 hover:border-text-2",
                  focusRing,
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>
        )}

        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14.5px] text-text-2">
          {TRUST.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check className="size-4 [stroke-width:2.5] text-verified" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ───────── 3. Services ─────────

export async function ServicesSection() {
  const { services, index, industryBySegment } = await homeData();
  // Hand-written cards first (in their order); a service added in the database without one still
  // gets a card, from its name and intro.
  const known = SERVICE_CARDS.filter((c) => services.some((s) => s.slug === c.slug));
  const added = services
    .filter((s) => !SERVICE_CARDS.some((c) => c.slug === s.slug))
    .map((s, i) => ({
      slug: s.slug,
      title: s.name,
      description: firstSentence(s.intro) || `Compare ${s.name.toLowerCase()} specialists.`,
      tone: TONE_ORDER[i % TONE_ORDER.length],
      Icon: Video,
    }));
  const cards = [...known, ...added].map((c) => ({
    ...c,
    popular: popularIndustryCombos(index.combos, 3, c.slug).flatMap((combo) => {
      const industry = industryBySegment.get(combo.segment);
      return industry ? [{ href: `/${c.slug}/${combo.segment}`, name: industry.name }] : [];
    }),
  }));
  if (!cards.length) return null;

  return (
    <section id="services" aria-labelledby="services-heading" className="scroll-mt-16">
      <div className={cn(shell, "flex flex-col gap-10")}>
        <SectionHeader
          id="services-heading"
          eyebrow="Services"
          title="Every kind of YouTube help, from specialists"
        />
        <ul className="grid gap-4 min-[620px]:grid-cols-2 min-[960px]:grid-cols-3">
          {cards.map(({ slug, title, description, tone, Icon, popular }) => (
            <li
              key={slug}
              className="relative flex h-full flex-col gap-4 rounded-[22px] border border-line bg-raised p-6 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:border-text-2/40 hover:shadow-[0_16px_32px_-16px_rgba(20,25,40,.22)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent motion-safe:hover:-translate-y-1"
            >
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-[13px] text-bg",
                  SOLID[tone],
                )}
                aria-hidden
              >
                <Icon className="size-[22px] [stroke-width:1.75]" />
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[19px] leading-tight font-[650]">
                  {/* The whole card is the link; the industry links sit above it. */}
                  <Link
                    href={`/${slug}`}
                    className="outline-none after:absolute after:inset-0 after:rounded-[22px] after:content-['']"
                  >
                    {title}
                  </Link>
                </h3>
                <p className="text-[15px] text-text-2">{description}</p>
              </div>
              {popular.length > 0 && (
                <p className="mt-auto border-t border-line pt-4 text-[14px] text-text-2">
                  Popular for{" "}
                  {popular.map((p, i) => (
                    <span key={p.href}>
                      {i > 0 && (i === popular.length - 1 ? " and " : ", ")}
                      <Link
                        href={p.href}
                        className={cn(
                          "relative z-10 rounded font-medium text-text hover:underline",
                          focusRing,
                        )}
                      >
                        {p.name}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ───────── 4. Agencies ─────────

const UNIT: Record<string, string> = {
  retainer: "month",
  per_video: "video",
  project: "project",
  performance: "month",
};

export async function AgenciesSection() {
  const agencies = await getHomeAgencies(); // [] when fewer than 3
  if (!agencies.length) return null;

  return (
    <section aria-labelledby="agencies-heading">
      <div className={cn(shell, "flex flex-col gap-10")}>
        <SectionHeader
          id="agencies-heading"
          eyebrow="Agencies"
          title="Agencies businesses and creators are looking at"
          lede="Every profile shows the industries they work in and where their prices start."
          link={{ href: "/agencies", label: "Browse all agencies" }}
        />
        <ul className="grid gap-4 min-[620px]:grid-cols-2 min-[960px]:grid-cols-3">
          {agencies.map((a) => {
            const main = a.services[0];
            const unit = UNIT[a.pricingModel ?? ""];
            return (
              <li
                key={a.id}
                className={cn(
                  "relative flex h-full flex-col gap-4 rounded-[22px] border border-line p-5 transition-[transform,box-shadow] duration-200 ease-out hover:shadow-[0_16px_32px_-16px_rgba(20,25,40,.22)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent motion-safe:hover:-translate-y-1",
                  a.sponsored ? "bg-surface" : "bg-raised",
                )}
              >
                <div className="flex items-start gap-3">
                  <AgencyLogo name={a.name} logoPath={a.logoPath} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="flex items-center gap-1.5 text-[17px] font-[650]">
                      <span className="truncate">{a.name}</span>
                      {a.isVerified && (
                        <BadgeCheck
                          className="size-[18px] shrink-0 [stroke-width:2] text-verified"
                          aria-label="Verified"
                        />
                      )}
                    </h3>
                    {a.hq && <p className="text-[14px] text-text-2">{a.hq.name}</p>}
                  </div>
                  {a.sponsored && (
                    <span className="ml-auto shrink-0 rounded-full border border-line px-2 py-0.5 text-[12.5px] text-text-2">
                      Sponsored
                    </span>
                  )}
                </div>
                {(main || a.industries.length > 0) && (
                  <ul className="flex flex-wrap gap-1.5 text-[13px]">
                    {main && (
                      <li className="rounded-full bg-accent-soft px-2.5 py-0.5 text-(--accent-on-soft)">
                        {main.name}
                      </li>
                    )}
                    {a.industries.slice(0, 2).map((i) => (
                      <li
                        key={i.slug}
                        className="rounded-full bg-surface px-2.5 py-0.5 text-text-2"
                      >
                        {i.name}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 text-[14px]">
                  {a.minBudgetUsd !== null ? (
                    <span>
                      From <strong className="font-semibold">{formatUsd(a.minBudgetUsd)}</strong>
                      {unit && <span className="text-text-2"> / {unit}</span>}
                    </span>
                  ) : (
                    <span />
                  )}
                  <Link
                    href={`/agency/${a.slug}`}
                    aria-label={`View profile: ${a.name}`}
                    className="flex items-center gap-1 font-medium text-accent outline-none after:absolute after:inset-0 after:rounded-[22px]"
                  >
                    View profile
                    <ArrowRight className="size-4 [stroke-width:2]" aria-hidden />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ───────── 5. How it works ─────────

/** Decorative illustrations: not real data. */
const panel = "flex h-44 items-center justify-center rounded-2xl p-5";
const miniBox = "rounded-xl border border-line bg-raised shadow-sm";

function MiniFinder() {
  return (
    <div className={cn(miniBox, "flex w-full max-w-[240px] flex-col gap-2 p-3 text-[12px]")}>
      {["Service", "Industry"].map((l) => (
        <div
          key={l}
          className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-2"
        >
          <span className="text-text-2">{l}</span>
          <ChevronDown className="size-3.5 text-text-2" />
        </div>
      ))}
      <div className="rounded-lg bg-accent py-2 text-center font-semibold text-on-accent">
        Find agencies
      </div>
    </div>
  );
}

function MiniRows() {
  return (
    <div className="flex w-full max-w-[250px] flex-col gap-2 text-[12px]">
      {[
        { i: "NV", w: "w-20", p: "$1.5k" },
        { i: "BK", w: "w-14", p: "$3k" },
      ].map((r) => (
        <div key={r.i} className={cn(miniBox, "flex items-center gap-2.5 p-2.5")}>
          <span className="grid size-7 place-items-center rounded-md bg-surface text-[10px] font-semibold">
            {r.i}
          </span>
          <span className="flex flex-1 flex-col gap-1">
            <span className={cn("h-2 rounded-full bg-text/70", r.w)} />
            <span className="h-1.5 w-16 rounded-full bg-line" />
          </span>
          <span className="font-semibold">{r.p}</span>
        </div>
      ))}
    </div>
  );
}

function MiniMessage() {
  return (
    <div className="flex w-full max-w-[240px] flex-col items-end gap-2 text-[12px]">
      <div className="rounded-2xl rounded-br-md bg-accent px-3 py-2 text-on-accent">
        Hi! We&apos;re a clinic looking for YouTube ads help.
      </div>
      <span className="flex items-center gap-1 text-(--mint)">
        <Check className="size-3.5 [stroke-width:2.5]" />
        Sent to the agency
      </span>
    </div>
  );
}

const STEPS = [
  {
    title: "Tell us what you need",
    body: "Pick the kind of YouTube help and your industry.",
    tint: "bg-accent-soft",
    Art: MiniFinder,
  },
  {
    title: "Compare side by side",
    body: "Starting prices, industries and verified badges, all in one place.",
    tint: "bg-(--mint-soft)",
    Art: MiniRows,
  },
  {
    title: "Contact them directly",
    body: "Message the agencies you like. No middleman, no fees.",
    tint: "bg-(--amber-soft)",
    Art: MiniMessage,
  },
];

export function HowItWorksSection() {
  return (
    <section id="how" aria-labelledby="how-heading" className="scroll-mt-16">
      <div className={cn(shell, "flex flex-col gap-10")}>
        <SectionHeader
          id="how-heading"
          eyebrow="How it works"
          title="From “which agency?” to a shortlist in minutes"
          lede="Free for businesses and creators. We don't take a cut of what you pay the agency."
        />
        <ol className="grid gap-4 min-[860px]:grid-cols-3">
          {STEPS.map(({ title, body, tint, Art }, i) => (
            <li
              key={title}
              className="flex flex-col gap-4 rounded-[22px] border border-line bg-raised p-4"
            >
              <div aria-hidden className={cn(panel, tint)}>
                <Art />
              </div>
              <div className="flex flex-col gap-1.5 px-2 pb-2">
                <h3 className="text-[18px] font-[650]">
                  <span className="text-text-2">{i + 1}.</span> {title}
                </h3>
                <p className="text-[15px] text-text-2">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ───────── 6. Why ─────────

const ALONE = [
  "Prices are hidden until a sales call",
  "No idea if they've worked in your industry",
  "Every agency says they're the best",
  "Ten tabs open, nothing to compare",
];
const WITH_US = [
  "Starting price on every profile",
  "Filter by the industries they work in",
  "Verified badges that can't be bought",
  "Side by side in one place, free",
];

export function WhySection() {
  return (
    <section aria-labelledby="why-heading">
      <div className={cn(shell, "flex flex-col gap-10")}>
        <SectionHeader
          id="why-heading"
          eyebrow={`Why ${BRAND_NAME}`}
          title="Why not just Google it?"
          lede="You can. Here's what usually happens."
        />
        <div className="grid gap-4 md:grid-cols-2 md:items-center">
          <div className="flex flex-col gap-5 rounded-[22px] bg-surface p-7">
            <h3 className="text-[19px] font-[650]">Searching on your own</h3>
            <ul className="flex flex-col gap-3">
              {ALONE.map((t) => (
                <li key={t} className="flex gap-3 text-text-2">
                  <X
                    className="mt-0.5 size-5 shrink-0 [stroke-width:2.25] text-(--coral)"
                    aria-label="No:"
                  />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-5 rounded-[22px] border border-accent/25 bg-accent-soft p-7 shadow-[0_20px_40px_-20px_rgba(31,94,255,.35)] md:-my-3 md:py-10">
            <h3 className="text-[19px] font-[650]">With {BRAND_NAME}</h3>
            <ul className="flex flex-col gap-3">
              {WITH_US.map((t) => (
                <li key={t} className="flex gap-3">
                  <Check
                    className="mt-0.5 size-5 shrink-0 [stroke-width:2.5] text-verified"
                    aria-label="Yes:"
                  />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────── 7. Industries ─────────

export async function IndustriesSection() {
  const { industries, index } = await homeData();
  // Industries have no page of their own: each tile links to its live service × industry page
  // with the most agencies. Industries without one aren't listed.
  const best = new Map<string, { href: string; count: number }>();
  for (const c of popularIndustryCombos(index.combos, Infinity)) {
    const slug = c.segment.slice(4);
    if (!best.has(slug)) best.set(slug, { href: `/${c.serviceSlug}/${c.segment}`, count: c.count });
  }
  const tiles = industries
    .filter((i) => best.has(i.slug))
    .sort((a, b) => best.get(b.slug)!.count - best.get(a.slug)!.count)
    .slice(0, 12);
  if (!tiles.length) return null;

  return (
    <section id="industries" aria-labelledby="industries-heading" className="scroll-mt-16">
      <div className={cn(shell, "flex flex-col gap-10")}>
        <SectionHeader
          id="industries-heading"
          eyebrow="Industries"
          title="Agencies that know your industry"
          lede="A clinic and a crypto project need very different videos. Start with people who've done yours before."
        />
        <ul className="grid grid-cols-2 gap-3 min-[720px]:grid-cols-3 min-[1000px]:grid-cols-4">
          {tiles.map((industry, i) => {
            const Icon = INDUSTRY_ICON[industry.slug] ?? Building2;
            return (
              <li key={industry.slug}>
                <Link
                  href={best.get(industry.slug)!.href}
                  className={cn(
                    "flex h-full min-h-16 items-center gap-3 rounded-[18px] border border-line bg-raised p-3 text-[15px] font-semibold transition-[transform,border-color] duration-200 ease-out hover:border-text-2/40 motion-safe:hover:-translate-y-0.5",
                    focusRing,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl",
                      SOFT[TONE_ORDER[i % TONE_ORDER.length]],
                    )}
                  >
                    <Icon className="size-5 [stroke-width:1.75]" />
                  </span>
                  {industry.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ───────── 8. Guides ─────────

export async function GuidesSection() {
  const guides = (await getLiveGuides()).slice(0, 3);
  if (!guides.length) return null;
  return (
    <section aria-labelledby="guides-heading">
      <div className={cn(shell, "flex flex-col gap-10")}>
        <SectionHeader
          id="guides-heading"
          eyebrow="Guides"
          title="Before you choose an agency"
          lede="Plain answers to what businesses and creators ask first."
          link={{ href: "/guides", label: "All guides" }}
        />
        <ul className="grid gap-8 min-[640px]:grid-cols-2 min-[1000px]:grid-cols-3">
          {guides.map((g) => (
            <li key={g.slug}>
              <GuideCard guide={g} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ───────── 9. FAQ ─────────

const FAQS = [
  {
    question: `Is ${BRAND_NAME} free for businesses and creators?`,
    answer:
      "Yes. Searching, comparing and contacting agencies is free. Agencies pay for Pro to manage their listing, and Pro never changes the ranking.",
  },
  {
    question: "Do you take a cut of what I pay the agency?",
    answer: "No. You agree prices and pay the agency directly.",
  },
  {
    question: "What happens when I request proposals?",
    answer:
      "You answer a few questions about your project and budget. We pass your request to up to three agencies that fit and manage their listing with us, and they contact you directly if they're interested.",
  },
  {
    question: "I run an agency. How do I get listed?",
    answer:
      "Listing is free: create a profile from List your agency and we review it before it goes live. To manage your listing and receive inquiries, you need Pro.",
  },
  {
    question: `Is ${BRAND_NAME} part of YouTube or Google?`,
    answer: "No. We are an independent directory and are not affiliated with YouTube or Google.",
  },
  {
    question: "Do you take part in my agreement with an agency?",
    answer: INDEPENDENT_DIRECTORY,
  },
];

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16">
      {/* The same text as the answers below. */}
      <JsonLd data={faqJsonLd(FAQS)} />
      <div className={cn(shell, "grid gap-10 min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
        <div className="flex flex-col gap-3">
          <p className="text-[13px] font-semibold tracking-[0.08em] text-accent uppercase">FAQ</p>
          <h2 id="faq-heading" className={h2}>
            Questions businesses and creators ask
          </h2>
          <p className="text-[17px] text-text-2">
            Still unsure?{" "}
            <Link
              href="/contact"
              className={cn("rounded font-medium text-accent hover:underline", focusRing)}
            >
              Contact us
            </Link>
          </p>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {FAQS.map((faq, i) => (
            <details key={faq.question} open={i === 0} className="group">
              <summary
                className={cn(
                  "flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded py-5 text-[17px] font-semibold [&::-webkit-details-marker]:hidden",
                  focusRing,
                )}
              >
                {faq.question}
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface transition-transform duration-200 ease-out group-open:rotate-180"
                  aria-hidden
                >
                  <ChevronDown className="size-4 [stroke-width:2]" />
                </span>
              </summary>
              <p className="max-w-[60ch] pb-5 text-[16px] text-text-2">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────── 10. Closing band ─────────

export function ClosingBand() {
  return (
    <section aria-labelledby="closing-heading" className={shell}>
      <div className="flex flex-col items-center gap-5 rounded-[28px] bg-[#16171a] px-6 py-14 text-center text-white md:py-20 site-dark:border site-dark:border-line site-dark:bg-raised">
        <MessageSquare className="size-7 [stroke-width:1.5] text-white/70" aria-hidden />
        <h2 id="closing-heading" className={cn(h2, "max-w-[18em]")}>
          Compare agencies that have worked in your niche before.
        </h2>
        <p className="text-[17px] text-white/75">
          Free for businesses and creators. Takes under a minute to start.
        </p>
        <FindAgenciesButton className="mt-2" />
      </div>
    </section>
  );
}
