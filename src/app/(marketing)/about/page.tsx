import { ArrowRight, EyeOff, LayoutGrid, ShieldQuestion, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { getProPrices } from "@/components/plan-columns";
import { COMPANY } from "@/lib/company";
import { getAgencyCount } from "@/lib/data/agencies";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { breadcrumbJsonLd, organizationJsonLd, webPageJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

// /about. The first three numbers are live from the database (ISR hourly), the Pro price comes
// from the plans table and the company facts from lib/company.ts. Nothing here is made up.
export const revalidate = 3600;

const TITLE = "About YT Agencies";
const DESCRIPTION = `${BRAND_NAME} is an independent directory of YouTube agencies. We help businesses and creators compare agencies by what they do, who they've done it for and what they charge, before anyone gets on a sales call.`;

export const metadata = buildMetadata({
  title: `About | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/about",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
];

const shell = "mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14";
const h2 = "text-[clamp(28px,3.4vw,42px)] leading-[1.1] font-[650] tracking-[-0.03em] text-balance";
const eyebrow = "text-[13px] font-semibold tracking-[0.08em] text-accent uppercase";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const pill = cn(
  "inline-flex h-12 items-center gap-2 self-start rounded-full px-6 font-semibold",
  focusRing,
);

const PROBLEMS: { title: string; body: string; Icon: LucideIcon; tint: string }[] = [
  {
    title: "Prices hidden until a sales call",
    body: "Most agency websites don't say what they charge, so every comparison costs you a week of calls.",
    Icon: EyeOff,
    tint: "bg-(--coral-soft) text-(--coral)",
  },
  {
    title: "Portfolios you can't check",
    body: "Screenshots of view counts are easy to fake. It's hard to tell which channels an agency really worked on.",
    Icon: ShieldQuestion,
    tint: "bg-(--violet-soft) text-(--violet)",
  },
  {
    title: "Big directories aren't built for YouTube",
    body: "General marketing directories mix YouTube specialists with web designers and app developers, so the right team gets buried.",
    Icon: LayoutGrid,
    tint: "bg-accent-soft text-accent",
  },
];

const RULES = [
  {
    title: "Ranked on merit",
    body: "Verified agencies first, then everyone else by quality score. Paying for Pro never changes the order.",
    link: { href: "/how-we-rank", label: "How we rank" },
  },
  {
    title: "Verified is earned",
    body: "We check the business, its website and its YouTube channels. The badge can't be bought, on any plan.",
  },
  {
    title: "Prices up front",
    body: "Profiles show where an agency's prices start, so you only talk to the ones that fit your budget.",
  },
  {
    title: "Independent",
    body: "We don't broker deals or take a cut of the work. We're not affiliated with YouTube or Google.",
  },
];

const count = new Intl.NumberFormat("en-US");

export default async function AboutPage() {
  const [agencies, services, industries, prices] = await Promise.all([
    getAgencyCount(),
    getServices(),
    getIndustries(),
    getProPrices(),
  ]);
  const stats = [
    { value: count.format(agencies), label: "Agencies listed", tone: "text-accent" },
    {
      value: count.format(services.length),
      label: "YouTube services",
      tone: "text-(--violet-on-soft)",
    },
    {
      value: count.format(industries.length),
      label: "Industries and niches",
      tone: "text-(--mint)",
    },
    { value: "0%", label: "Commission, ever", tone: "text-(--coral-on-soft)" },
  ];
  const { city, country, foundedYear, founder, email } = COMPANY;
  const based = [city, country].filter(Boolean).join(", ");
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Founded", value: String(foundedYear) },
    ...(founder.name ? [{ label: "Operated by", value: founder.name }] : []),
    ...(based ? [{ label: "Based in", value: based }] : []),
    {
      label: "Contact",
      value: (
        <a
          href={`mailto:${email}`}
          className={cn("rounded text-accent hover:underline", focusRing)}
        >
          {email}
        </a>
      ),
    },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={webPageJsonLd({
          type: "AboutPage",
          name: TITLE,
          description: DESCRIPTION,
          path: "/about",
        })}
      />
      <JsonLd data={organizationJsonLd()} />

      {/* 1. Hero */}
      <section className="home-grid overflow-clip px-4 pt-8 pb-10 md:px-6 md:pb-14">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
          <Breadcrumbs items={crumbs} />
          <h1 className="max-w-[15em] text-[clamp(40px,5.6vw,68px)] leading-[1.02] font-[680] tracking-[-0.045em] text-balance">
            Choosing a YouTube agency shouldn&apos;t be{" "}
            <span className="text-(--coral-on-soft)">a gamble.</span>
          </h1>
          <p className="max-w-[40em] text-[clamp(17px,1.6vw,19px)] leading-normal text-text-2">
            {DESCRIPTION}
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <dl className="grid grid-cols-2 overflow-hidden rounded-[22px] border border-line bg-raised md:grid-cols-4">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className={cn(
                    "flex flex-col gap-1 border-line p-5 md:p-6",
                    i % 2 === 1 && "border-l",
                    i >= 2 && "border-t md:border-t-0",
                    i === 2 && "md:border-l",
                  )}
                >
                  <dt className="order-2 text-[14.5px] text-text-2">{s.label}</dt>
                  <dd
                    className={cn(
                      "font-mono text-[clamp(28px,3.4vw,40px)] leading-none font-semibold tabular-nums",
                      s.tone,
                    )}
                  >
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-[13.5px] text-text-2">Numbers update live from the directory.</p>
          </div>
        </div>
      </section>

      {/* 2. Why we started */}
      <section aria-labelledby="why-heading">
        <div className={cn(shell, "grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
          <div className="flex flex-col gap-3">
            <p className={eyebrow}>Why we started</p>
            <h2 id="why-heading" className={h2}>
              Hiring for YouTube was harder than it should be
            </h2>
          </div>
          <ul className="flex flex-col gap-4">
            {PROBLEMS.map(({ title, body, Icon, tint }) => (
              <li
                key={title}
                className="flex gap-4 rounded-[22px] border border-line bg-raised p-5 md:p-6"
              >
                <span
                  aria-hidden
                  className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tint)}
                >
                  <Icon className="size-5 [stroke-width:1.75]" />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[18px] font-[650]">{title}</h3>
                  <p className="text-[15.5px] text-text-2">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. What we believe */}
      <section aria-labelledby="rules-heading">
        <div className={cn(shell, "flex flex-col gap-10")}>
          <div className="flex flex-col gap-3">
            <p className={eyebrow}>What we believe</p>
            <h2 id="rules-heading" className={h2}>
              Four rules we don&apos;t break
            </h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RULES.map((r, i) => (
              <li
                key={r.title}
                className="flex flex-col gap-3 rounded-[22px] border border-line bg-raised p-6"
              >
                <span aria-hidden className="font-mono text-[15px] font-semibold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[18px] font-[650]">{r.title}</h3>
                <p className="text-[15.5px] text-text-2">{r.body}</p>
                {r.link && (
                  <Link
                    href={r.link.href}
                    className={cn(
                      "mt-auto inline-flex min-h-11 items-center gap-1.5 self-start rounded font-semibold text-accent hover:underline",
                      focusRing,
                    )}
                  >
                    {r.link.label}
                    <ArrowRight className="size-4 [stroke-width:2]" aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. Who it's for */}
      <section aria-label="Who it's for" className={shell}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-[28px] bg-accent-soft p-7 md:p-10">
            <p className={eyebrow}>For businesses and creators</p>
            <h2 className="text-[clamp(24px,2.6vw,32px)] leading-tight font-[650] tracking-[-0.025em]">
              Free, and you only talk to the agencies you choose
            </h2>
            <p className="text-[16px] text-text-2">
              Browse by service and industry, compare starting prices, read checked reviews, and
              contact agencies directly or request proposals.
            </p>
            <Link
              href="/#finder"
              className={cn(pill, "mt-auto bg-accent text-on-accent hover:bg-(--accent-hover)")}
            >
              Compare agencies
              <ArrowRight className="size-5 [stroke-width:2]" aria-hidden />
            </Link>
          </div>
          <div className="flex flex-col gap-4 rounded-[28px] bg-[#16171a] p-7 text-white md:p-10 site-dark:border site-dark:border-line site-dark:bg-raised">
            <p className="text-[13px] font-semibold tracking-[0.08em] text-white/70 uppercase">
              For agencies
            </p>
            <h2 className="text-[clamp(24px,2.6vw,32px)] leading-tight font-[650] tracking-[-0.025em]">
              Get found by people already looking for you
            </h2>
            <p className="text-[16px] text-white/75">
              Listing is free. Pro (${prices.monthly}/month) lets you manage your profile and
              receive inquiries, with no commission on the work you win.
            </p>
            <Link
              href="/pricing"
              className="mt-auto inline-flex h-12 items-center gap-2 self-start rounded-full bg-white px-6 font-semibold text-[#16171a] hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              See pricing
              <ArrowRight className="size-5 [stroke-width:2]" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* 5. The company */}
      <section aria-labelledby="company-heading">
        <div className={cn(shell, "flex flex-col gap-10")}>
          <div className="flex flex-col gap-3">
            <p className={eyebrow}>The company</p>
            <h2 id="company-heading" className={h2}>
              Who&apos;s behind {BRAND_NAME}
            </h2>
          </div>
          <dl className="grid overflow-hidden rounded-[22px] border border-line bg-raised sm:grid-cols-2 lg:grid-cols-4">
            {facts.map((f, i) => (
              <div
                key={f.label}
                className={cn(
                  "flex min-w-0 flex-col gap-1 border-line p-6",
                  i > 0 && "border-t",
                  i % 2 === 1 && "sm:border-l",
                  i < 2 && "sm:border-t-0",
                  i >= 2 && "lg:border-t-0",
                  i === 2 && "lg:border-l",
                )}
              >
                <dt className="text-[14px] text-text-2">{f.label}</dt>
                <dd className="text-[17px] font-semibold break-words">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 6. Closing band */}
      <section aria-labelledby="closing-heading" className={shell}>
        <div className="flex flex-col items-center gap-5 rounded-[28px] bg-[#16171a] px-6 py-14 text-center text-white md:py-20 site-dark:border site-dark:border-line site-dark:bg-raised">
          <h2 id="closing-heading" className={cn(h2, "max-w-[18em]")}>
            Compare YouTube agencies that already know your niche.
          </h2>
          <p className="text-[17px] text-white/75">Free for businesses and creators.</p>
          <Link
            href="/#services"
            className="mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-[#16171a] transition-transform duration-150 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Browse agencies
            <ArrowRight className="size-5 [stroke-width:2]" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
