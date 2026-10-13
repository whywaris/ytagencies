import {
  ChartColumn,
  ChevronDown,
  ChevronRight,
  Megaphone,
  Play,
  Search,
  Smartphone,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { JsonLd } from "@/components/json-ld";
import { getDirectoryIndex, getPopularIndustries } from "@/lib/data/agencies";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { faqJsonLd } from "@/lib/seo/json-ld";
import { BRAND_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

// Home page sections below the hero. Server components, real data only: a card, chip or tile
// without data is left out, and a section with nothing to show isn't rendered.

const shell = "mx-auto max-w-[1200px] px-4 py-16 md:px-6 md:py-24";

function SectionHeader({
  id,
  title,
  lede,
  link,
}: {
  id: string;
  title: string;
  lede: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="flex max-w-[640px] flex-col gap-3">
        <h2
          id={id}
          className="text-[clamp(28px,3.4vw,42px)] leading-[1.1] font-[650] tracking-[-0.03em] text-balance"
        >
          {title}
        </h2>
        <p className="text-[17px] text-text-2">{lede}</p>
      </div>
      {link && (
        <Link
          href={link.href}
          className="flex min-h-11 items-center gap-1 font-medium text-accent hover:underline"
        >
          {link.label}
          <ChevronRight className="size-4 [stroke-width:2]" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** Tile colours (DESIGN.md): soft background with the matching colour. */
const TONES = {
  blue: "bg-(--accent-soft) text-accent",
  violet: "bg-(--violet-soft) text-(--violet)",
  mint: "bg-(--mint-soft) text-(--mint)",
  coral: "bg-(--coral-soft) text-(--coral)",
  amber: "bg-(--amber-soft) text-(--amber)",
  pink: "bg-(--pink-soft) text-(--pink)",
} as const;
type Tone = keyof typeof TONES;

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
];

/** "Doctors & clinics" → "doctors & clinics"; keeps "SaaS". */
const inSentence = (name: string) =>
  /^[A-Z][a-z]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name;

export async function ServicesSection() {
  const [services, industries, index] = await Promise.all([
    getServices(),
    getIndustries(),
    getDirectoryIndex(),
  ]);
  const cards = SERVICE_CARDS.filter((c) => services.some((s) => s.slug === c.slug)).map((c) => ({
    ...c,
    // Indexable industry pages for this service (3+ published agencies), most agencies first.
    chips: index.combos
      .filter((combo) => combo.serviceSlug === c.slug && combo.segment.startsWith("for-"))
      .sort((a, b) => b.count - a.count)
      .flatMap((combo) => {
        const industry = industries.find((i) => `for-${i.slug}` === combo.segment);
        return industry ? [{ href: `/${c.slug}/${combo.segment}`, name: industry.name }] : [];
      })
      .slice(0, 4),
  }));
  if (!cards.length) return null;

  return (
    <section id="services" aria-labelledby="services-heading" className="scroll-mt-16">
      <div className={cn(shell, "flex flex-col gap-10")}>
        <SectionHeader
          id="services-heading"
          title="Every kind of YouTube help, from specialists"
          lede="Pick what you need, then narrow it down to agencies that already work in your industry."
        />
        <ul className="grid gap-4 min-[620px]:grid-cols-2 min-[960px]:grid-cols-3">
          {cards.map(({ slug, title, description, tone, Icon, chips }) => (
            <li
              key={slug}
              className="relative flex flex-col gap-4 rounded-[22px] border border-line bg-raised p-6 transition-[border-color,box-shadow] duration-200 ease-out hover:border-text-2 hover:shadow-[0_1px_2px_rgba(20,25,40,.05),0_12px_28px_-10px_rgba(20,25,40,.16)]"
            >
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-[13px]",
                  TONES[tone],
                )}
                aria-hidden
              >
                <Icon className="size-[22px] [stroke-width:1.75]" />
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[19px] leading-tight font-[650]">
                  {/* The whole card is the link; chips sit above it. */}
                  <Link
                    href={`/${slug}`}
                    className="after:absolute after:inset-0 after:rounded-[22px] after:content-['']"
                  >
                    {title}
                  </Link>
                </h3>
                <p className="text-[14.5px] text-text-2">{description}</p>
              </div>
              {chips.length > 0 && (
                <ul className="mt-auto flex flex-wrap gap-1.5 border-t border-line-2 pt-4">
                  {chips.map((chip) => (
                    <li key={chip.href} className="relative z-10">
                      <Link
                        href={chip.href}
                        className="block rounded-full bg-surface px-2.5 py-1 text-[12.5px] text-text-2 transition-colors duration-150 hover:text-text"
                      >
                        for {inSentence(chip.name)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS: { title: string; body: string; tone: Tone }[] = [
  {
    title: "Tell us what you need",
    body: "Your industry, the kind of YouTube help you want and your monthly budget.",
    tone: "blue",
  },
  {
    title: "Compare agencies",
    body: "See the industries they work in, the channels they've worked on and their starting price.",
    tone: "violet",
  },
  {
    title: "Contact them directly",
    body: "Reach out to the agencies you like. No middleman, no fees.",
    tone: "mint",
  },
];

/** The step number is text, so blue and violet use their darker "on soft" shades (4.5:1). */
const STEP_TONES: Record<Tone, string> = {
  ...TONES,
  blue: "bg-(--accent-soft) text-(--accent-on-soft)",
  violet: "bg-(--violet-soft) text-(--violet-on-soft)",
};

export function HowItWorksSection() {
  return (
    <section id="how" aria-labelledby="how-heading" className="scroll-mt-16">
      <div className={cn(shell, "flex flex-col gap-10")}>
        <SectionHeader
          id="how-heading"
          title="How it works"
          lede="Free for businesses. We don't take a cut of what you pay the agency."
        />
        <ol className="grid gap-8 min-[860px]:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3">
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-[13px] text-[17px] font-[650]",
                  STEP_TONES[step.tone],
                )}
                aria-hidden
              >
                {i + 1}
              </span>
              <h3 className="text-[18px] leading-snug font-[650]">{step.title}</h3>
              <p className="max-w-[38ch] text-[15px] text-text-2">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const TILE_TONES: Tone[] = ["blue", "mint", "amber", "coral", "violet", "pink"];
/** The tile's soft background, and its colour for the chevron only. */
const TILE_BG: Record<Tone, string> = {
  blue: "bg-(--accent-soft)",
  violet: "bg-(--violet-soft)",
  mint: "bg-(--mint-soft)",
  coral: "bg-(--coral-soft)",
  amber: "bg-(--amber-soft)",
  pink: "bg-(--pink-soft)",
};
const TILE_ICON: Record<Tone, string> = {
  blue: "text-accent",
  violet: "text-(--violet)",
  mint: "text-(--mint)",
  coral: "text-(--coral)",
  amber: "text-(--amber)",
  pink: "text-(--pink)",
};

export async function IndustriesSection() {
  // Industries have no page of their own (docs/SEO.md), so each tile links to its best service ×
  // industry page. Industries without a published agency aren't listed.
  const industries = await getPopularIndustries(100);
  if (!industries.length) return null;

  return (
    <section
      id="industries"
      aria-labelledby="industries-heading"
      className="scroll-mt-16 bg-surface"
    >
      <div className={cn(shell, "flex flex-col gap-10")}>
        <SectionHeader
          id="industries-heading"
          title="Agencies that know your industry"
          lede="A clinic and a crypto project need very different videos. Start with people who've done yours before."
        />
        <ul className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
          {industries.map(({ industry, service }, i) => {
            const tone = TILE_TONES[i % TILE_TONES.length];
            return (
              <li key={industry.slug}>
                <Link
                  href={`/${service.slug}/for-${industry.slug}`}
                  className={cn(
                    "flex h-full min-h-11 items-center justify-between gap-2 rounded-[18px] p-4 text-[15px] font-semibold text-text transition-transform duration-200 ease-out motion-safe:hover:-translate-y-0.5 min-[480px]:px-[22px] min-[480px]:py-5 min-[480px]:text-[16px]",
                    TILE_BG[tone],
                  )}
                >
                  {industry.name}
                  <ChevronRight
                    className={cn("size-4 shrink-0 [stroke-width:2.25]", TILE_ICON[tone])}
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const FAQS = [
  {
    question: `Is ${BRAND_NAME} free for businesses?`,
    answer:
      "Yes. Searching, comparing and contacting agencies is free. Agencies pay to manage their listing and for extra visibility, and paid placements are always labeled Sponsored.",
  },
  {
    question: "Do you take a cut of what I pay the agency?",
    answer: "No. You agree prices and pay the agency directly.",
  },
  {
    question: "What happens when I use Find my agency?",
    answer:
      "You answer a few questions about your business and budget. We send your request to up to three matching agencies that manage their listing with us, and they contact you directly.",
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
];

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16">
      <JsonLd data={faqJsonLd(FAQS)} />
      <div className={cn(shell, "grid gap-10 min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
        <div className="flex flex-col gap-3">
          <h2
            id="faq-heading"
            className="text-[clamp(28px,3.4vw,42px)] leading-[1.1] font-[650] tracking-[-0.03em] text-balance"
          >
            Questions business owners ask
          </h2>
          <p className="text-[17px] text-text-2">
            Still unsure?{" "}
            <Link href="/contact" className="font-medium text-accent hover:underline">
              Contact us
            </Link>
          </p>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {FAQS.map((faq, i) => (
            <details key={faq.question} open={i === 0} className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-5 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
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
