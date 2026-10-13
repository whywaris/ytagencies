import { BadgeCheck, ChevronDown, CircleDollarSign, Clapperboard } from "lucide-react";
import Link from "next/link";

import { AgencyLogo } from "@/components/agency-logo";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AgencySearch } from "@/components/forms/agency-search";
import { JsonLd } from "@/components/json-ld";
import { PlanColumns } from "@/components/plan-columns";
import { getSiteNumbers } from "@/lib/data/agency-stats";
import { getAgenciesForService, type AgencyListItem } from "@/lib/data/agencies";
import { getPlacement } from "@/lib/data/placement";
import { getServices } from "@/lib/data/taxonomy";
import { contractLabel } from "@/lib/pricing";
import { unitSuffix } from "@/lib/profile-copy";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/site";
import { cn } from "@/lib/utils";

// Static and indexable: it targets agency owners (docs/mockups/list-your-agency.html, without
// the old Founding offer). The search runs as a server action; adding an agency lives at
// /list-your-agency/new and managing one at /claim/<slug> (both sign-in, noindex).
export const revalidate = 3600;

export const metadata = buildMetadata({
  title: `List your YouTube agency for free | ${BRAND_NAME}`,
  description:
    "Get your YouTube agency in front of businesses looking to hire. Listings are free; Pro lets you manage yours, receive inquiries and link your website.",
  path: "/list-your-agency",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "List your agency", path: "/list-your-agency" },
];

/** The live strip shows only once the last 30 days have this many views. */
const MIN_VIEWS_FOR_NUMBERS = 500;

const FAQS = [
  {
    question: "Is listing free?",
    answer:
      "Yes. A listing is free for as long as you like, and businesses can find it. Managing it, receiving inquiries and linking your website need Pro.",
  },
  {
    question: "You listed my agency. Why?",
    answer:
      "We list agencies from public information so businesses can compare them. Manage your listing to correct anything, add your work and receive inquiries. You can also ask us to remove it.",
  },
  {
    question: "What do I get with Pro?",
    answer:
      "You can edit your profile, businesses can contact you from it, and we send you Get matched requests that fit your services. You also get a link to your website, your reply time on your profile, a place above unmanaged listings and no other agencies suggested on your profile.",
  },
  {
    question: "What happens if I cancel?",
    answer:
      "Your profile stays up as a free listing and we keep your details. Editing and inquiries stop until you subscribe again. Monthly plans run to the end of the month you've paid for.",
  },
  {
    question: "Can I pay to rank higher?",
    answer:
      "Agencies on Pro are listed above unmanaged ones, and Sponsored spots sit at the top of a page with a clear label. Inside each group, the order depends on verification, profile completeness, reviews and reply time, and none of that can be bought.",
  },
  {
    question: "How do I get Verified?",
    answer:
      "Add the channels you've worked on and ask for verification from your dashboard. We check your YouTube channels, your website and that your business is real. The badge is free and can't be bought.",
  },
];

const count = new Intl.NumberFormat("en-US");
const usd = (n: number) => `$${count.format(n)}`;
const btn =
  "inline-flex h-12 items-center justify-center rounded-full px-6 text-[15.5px] font-semibold whitespace-nowrap transition-[transform,border-color] duration-150";
const btnPrimary = `${btn} bg-accent text-on-accent shadow-[0_1px_2px_rgba(31,94,255,.3),0_8px_20px_-6px_rgba(31,94,255,.45)] motion-safe:hover:-translate-y-px`;
const btnLight = `${btn} border border-line bg-raised hover:border-text-2`;
const h2 =
  "text-[clamp(28px,3.4vw,40px)] leading-[1.08] font-[650] tracking-[-0.03em] text-balance";
const lede = "mt-3 max-w-[36em] text-[17px] text-text-2";
const sec = "px-4 py-16 md:px-6 md:py-22";
const wrap = "mx-auto max-w-[1120px]";

/** A real profile to show what one looks like: the best-ranked agency with a price. */
async function sampleAgency(): Promise<AgencyListItem | null> {
  for (const s of await getServices()) {
    const found = (await getAgenciesForService(s.id)).find((a) => a.minBudgetUsd !== null);
    if (found) return found;
  }
  return null;
}

export default async function ListYourAgencyPage() {
  const [numbers, sample, placement] = await Promise.all([
    getSiteNumbers(),
    sampleAgency(),
    getPlacement(),
  ]);
  const channels = sample
    ? placement
        .channels(sample.id)
        .filter((c) => c.subscribers !== null)
        .slice(0, 2)
    : [];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <JsonLd data={faqJsonLd(FAQS)} />

      <section className="home-hero relative isolate overflow-clip px-4 pt-7 pb-16 text-center md:px-6 md:pb-18">
        <div
          aria-hidden
          className="home-hero-glow pointer-events-none absolute [inset:-10%_-10%_10%_-10%] -z-10 blur-[60px]"
        />
        <div className="mx-auto max-w-[1120px] text-left">
          <Breadcrumbs items={breadcrumbs} />
        </div>
        <p className="mt-10 inline-flex items-center rounded-full border border-line bg-raised px-4 py-1.5 text-[14px] text-text-2">
          Listings are free. Pro lets you manage yours.
        </p>
        <h1 className="mx-auto mt-6 max-w-[14em] text-[clamp(34px,5vw,58px)] leading-[1.04] font-[650] tracking-[-0.035em] text-balance">
          Get found by businesses looking for YouTube help
        </h1>
        <p className="mx-auto mt-4 max-w-[34em] text-[18px] text-text-2">
          Business owners compare agencies here by industry, price and the channels you&apos;ve
          worked on. Listing is free.
        </p>
        <AgencySearch />
      </section>

      {numbers.views >= MIN_VIEWS_FOR_NUMBERS && (
        <div className="px-4 md:px-6">
          <div
            className={cn(
              wrap,
              "relative -mt-6 grid overflow-hidden rounded-[20px] border border-line bg-raised text-center tabular-nums sm:grid-cols-3",
            )}
          >
            {[
              [numbers.views, "directory and profile views"],
              [numbers.inquiries, "inquiries sent to agencies"],
              [numbers.agencies, "agencies listed"],
            ].map(([n, label]) => (
              <div
                key={label}
                className="border-b border-line-2 px-6 py-[22px] last:border-0 sm:border-r sm:border-b-0"
              >
                <b className="block text-[30px] font-[650] tracking-[-0.025em]">
                  {count.format(Number(n))}
                </b>
                <span className="text-[13.5px] text-text-2">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-center text-[12.5px] text-text-2">Last 30 days.</p>
        </div>
      )}

      <section aria-labelledby="steps-h" className={sec}>
        <div className={cn(wrap, "text-center")}>
          <h2 id="steps-h" className={h2}>
            Up and running in a few minutes
          </h2>
          <p className={cn(lede, "mx-auto")}>No sales calls, no setup fees.</p>
          <ol className="mt-11 grid gap-8 text-left md:grid-cols-3">
            {[
              [
                "Claim or add your agency",
                "Find your listing and confirm it with an email on your website's domain, or add a new one.",
                "bg-(--accent-soft) text-(--accent-on-soft)",
              ],
              [
                "Get Pro",
                "Monthly or yearly. Pro turns on your contact form and Get matched requests, and lets you edit your profile.",
                "bg-(--violet-soft) text-(--violet-on-soft)",
              ],
              [
                "Get inquiries",
                "Businesses contact you directly. Inquiries land in your inbox and your dashboard.",
                "bg-(--mint-soft) text-(--mint)",
              ],
            ].map(([title, body, tone], i) => (
              <li key={title}>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-11 place-items-center rounded-[13px] text-[17px] font-bold",
                    tone,
                  )}
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 mb-1.5 text-[19px] font-[650]">{title}</h3>
                <p className="text-[15px] text-text-2">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="profile-h" className={cn(sec, "bg-surface")}>
        <div
          className={cn(
            wrap,
            "grid items-center gap-10 min-[900px]:grid-cols-2 min-[900px]:gap-14",
          )}
        >
          <div>
            <h2 id="profile-h" className={h2}>
              A profile that shows your real work
            </h2>
            <p className={lede}>
              Not another logo in a long list. Your profile shows what businesses actually need to
              decide.
            </p>
            <ul className="mt-7 grid gap-[18px]">
              {[
                [
                  Clapperboard,
                  "Channels you've worked on",
                  "With subscriber counts from YouTube. Clients can confirm them for you.",
                  "bg-(--accent-soft) text-(--accent-on-soft)",
                ],
                [
                  CircleDollarSign,
                  "Pricing up front",
                  "Businesses that contact you already know your starting price, so fewer calls go nowhere.",
                  "bg-(--amber-soft) text-(--amber-on-soft)",
                ],
                [
                  BadgeCheck,
                  "A Verified badge you earn",
                  "Pass our checks and get a badge that can't be bought.",
                  "bg-(--mint-soft) text-(--mint)",
                ],
              ].map(([Icon, title, body, tone]) => {
                const I = Icon as typeof Clapperboard;
                return (
                  <li key={title as string} className="flex gap-3.5">
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl",
                        tone as string,
                      )}
                    >
                      <I className="size-5" aria-hidden />
                    </span>
                    <div>
                      <b className="block text-[16px]">{title as string}</b>
                      <span className="text-[14.5px] text-text-2">{body as string}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          {sample && (
            <figure className="rounded-[24px] border border-line bg-raised p-6 shadow-[0_1px_2px_rgba(20,25,40,.05),0_12px_32px_-12px_rgba(20,25,40,.16)] min-[900px]:-rotate-1">
              <div className="flex items-center gap-3.5">
                <AgencyLogo name={sample.name} logoPath={sample.logoPath} />
                <div className="min-w-0">
                  <Link
                    href={`/agency/${sample.slug}`}
                    className="flex flex-wrap items-center gap-2 text-[20px] font-semibold tracking-[-0.02em] hover:underline"
                  >
                    {sample.name}
                    {sample.isVerified && (
                      <span className="inline-flex h-[22px] items-center rounded-full bg-(--mint-soft) px-2 text-[11.5px] font-[650] text-(--mint)">
                        ✓ Verified
                      </span>
                    )}
                  </Link>
                  <span className="text-[13px] text-text-2">
                    {[
                      sample.hq?.name,
                      sample.teamSize && `${sample.teamSize.replace("-", "–")} people`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              </div>
              {sample.tagline && (
                <p className="mt-3.5 text-[14.5px] text-text-2">{sample.tagline}</p>
              )}
              <dl className="mt-4 grid grid-cols-3 overflow-hidden rounded-[14px] border border-line-2 tabular-nums">
                {[
                  [
                    "Starting price",
                    `${usd(sample.minBudgetUsd!)}${unitSuffix(sample.pricingModel)}`,
                  ],
                  ["Contract", sample.minContract ? contractLabel(sample.minContract) : null],
                  ["Services", sample.services[0]?.name ?? null],
                ]
                  .filter((r): r is [string, string] => !!r[1])
                  .map(([k, v]) => (
                    <div key={k} className="border-r border-line-2 p-3 last:border-0">
                      <dt className="text-[11.5px] text-text-2">{k}</dt>
                      <dd className="text-[15px] font-semibold">{v}</dd>
                    </div>
                  ))}
              </dl>
              {channels.length > 0 && (
                <ul className="mt-3.5 flex flex-wrap gap-2">
                  {channels.map((c) => (
                    <li
                      key={c.channelId}
                      className="rounded-full bg-surface px-2.5 py-1 text-[12.5px]"
                    >
                      {c.title} ·{" "}
                      {Intl.NumberFormat("en-US", { notation: "compact" }).format(c.subscribers!)}
                    </li>
                  ))}
                </ul>
              )}
              <figcaption className="mt-4 text-[12.5px] text-text-2">
                A real profile on {BRAND_NAME}.
              </figcaption>
            </figure>
          )}
        </div>
      </section>

      <section aria-labelledby="plans-h" className={sec}>
        <div className={cn(wrap, "text-center")}>
          <h2 id="plans-h" className={h2}>
            Listing is free. Pro is how you hear from businesses.
          </h2>
          <p className={cn(lede, "mx-auto mb-11")}>
            Every listing is free. Pro lets you manage yours and receive inquiries.
          </p>
          <PlanColumns />
          <p className="mt-[22px] text-[14px] text-text-2">
            Rankings can&apos;t be bought. Sponsored spots are labeled, and the Verified badge is
            only given when our checks pass.{" "}
            <Link href="/how-we-rank" className="font-semibold text-accent hover:underline">
              How we rank
            </Link>
          </p>
        </div>
      </section>

      <section aria-labelledby="faq-h" className={cn(sec, "bg-surface")}>
        <div
          className={cn(
            wrap,
            "grid gap-6 min-[900px]:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] min-[900px]:gap-16",
          )}
        >
          <div>
            <h2 id="faq-h" className={h2}>
              Questions agencies ask
            </h2>
            <p className={lede}>
              Anything else? Email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-accent hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>
          <div className="divide-y divide-line border-b border-line">
            {FAQS.map((f, i) => (
              <details key={f.question} open={i === 0} className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-[18px] text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {f.question}
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-raised transition-transform duration-200 group-open:rotate-180"
                  >
                    <ChevronDown className="size-4" />
                  </span>
                </summary>
                <p className="max-w-[42em] pb-5 text-[15.5px] text-text-2">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={sec}>
        <div
          className={cn(
            wrap,
            "rounded-[32px] bg-[linear-gradient(120deg,var(--violet-soft),var(--accent-soft)_45%,var(--coral-soft))] px-6 py-14 text-center md:px-8",
          )}
        >
          <h2 className={h2}>Your next client may already be looking</h2>
          <p className={cn(lede, "mx-auto")}>
            Find your listing or add your agency. It takes about five minutes.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href="#agency-search" className={btnPrimary}>
              Find my agency
            </a>
            <Link href="/list-your-agency/new" className={btnLight}>
              Add your agency
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
