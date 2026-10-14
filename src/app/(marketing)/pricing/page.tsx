import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { getProPrices, PlanColumns } from "@/components/plan-columns";
import { COMPANY } from "@/lib/company";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/site";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

// Agency pricing (was /for-agencies/pricing: 301 in next.config). Listing is free, Pro manages it
// (lib/entitlements.ts), Sponsored is arranged by email. Prices come from the plans table.

export async function generateMetadata() {
  const { monthly } = await getProPrices();
  return buildMetadata({
    title: `Pricing for YouTube agencies · ${BRAND_NAME}`,
    description: `List your agency free. Pro ($${monthly}/month) puts you in front of business owners on Google, in AI answers and in our directory. No commission.`,
    path: "/pricing",
  });
}

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Pricing", path: "/pricing" },
];

const shell = "mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14";
const h2 = "text-[clamp(28px,3.4vw,42px)] leading-[1.1] font-[650] tracking-[-0.03em] text-balance";
const eyebrow = "text-[13px] font-semibold tracking-[0.08em] text-accent uppercase";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// ───────── Decorative illustrations (aria-hidden, not real data) ─────────

const mini =
  "w-full max-w-[300px] rounded-xl border border-line bg-raised p-3.5 text-left shadow-sm";

function GoogleResult() {
  return (
    <div className={cn(mini, "flex flex-col gap-1 text-[12.5px]")}>
      <span className="text-text-2">{SITE_DOMAIN} › youtube-ads › dentists</span>
      <span className="text-[15px] font-medium text-accent">
        Best YouTube Ads Agencies for Dentists
      </span>
      <span className="text-text-2">
        …compare starting prices… <strong className="font-semibold text-text">Your Agency</strong>{" "}
        works with dental clinics…
      </span>
    </div>
  );
}

function ChatAnswer() {
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-2 text-[12.5px]">
      <p className="self-end rounded-2xl rounded-br-md bg-accent px-3 py-2 text-on-accent">
        Who does YouTube ads for dentists?
      </p>
      <div className={cn(mini, "flex flex-col gap-1.5 rounded-bl-md")}>
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="size-3.5 text-(--violet)" /> A few options:
        </span>
        <span className="text-text-2">
          Your Agency: starts at $1.5k a month, works with clinics.
        </span>
        <span className="self-start rounded-full bg-surface px-2 py-0.5 text-[11px] text-text-2">
          {SITE_DOMAIN}
        </span>
      </div>
    </div>
  );
}

function MatchRequest() {
  return (
    <div className={cn(mini, "flex flex-col gap-2.5 text-[12.5px]")}>
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold">New match request</span>
        <span className="rounded-full bg-(--mint-soft) px-2 py-0.5 text-[11px] font-semibold text-(--mint)">
          Fits you
        </span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        {["YouTube Ads", "Dentists", "$2k–$5k / month"].map((c) => (
          <span key={c} className="rounded-full bg-surface px-2 py-0.5 text-text-2">
            {c}
          </span>
        ))}
      </span>
    </div>
  );
}

function Inquiry() {
  return (
    <div className={cn(mini, "flex flex-col gap-2 text-[12.5px]")}>
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold">New inquiry from your profile</span>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-(--accent-on-soft)">
          0% fee
        </span>
      </span>
      <span className="text-text-2">
        “Hi, we&apos;re a clinic in Austin and want to start YouTube ads next month…”
      </span>
    </div>
  );
}

const CHANNELS = [
  {
    title: "Found on Google",
    body: "We build a page for every service, industry and city, like “YouTube ads agency for dentists”. Your profile is listed on every page that fits you.",
    tint: "bg-accent-soft",
    Art: GoogleResult,
  },
  {
    title: "Built for AI search",
    body: "More buyers now ask ChatGPT, Perplexity or Google's AI. Profiles are structured so these tools can read your services, industries and prices, and point buyers to you.",
    tint: "bg-(--violet-soft)",
    Art: ChatAnswer,
  },
  {
    title: "Matched to the right buyers",
    body: "Businesses that don't want to browse tell us what they need. Requests go only to Pro agencies whose services and industries fit.",
    tint: "bg-(--mint-soft)",
    Art: MatchRequest,
  },
  {
    title: "Inquiries straight to your inbox",
    body: "Buyers contact you from your profile. No middleman, no bidding against other agencies, no commission on the work you win.",
    tint: "bg-(--amber-soft)",
    Art: Inquiry,
  },
];

const FAQS = [
  {
    question: "How many leads will I get?",
    answer:
      "We don't promise a number. It depends on your services, industries and how complete your profile is. Your dashboard shows views, website clicks and inquiries, so you can judge it yourself.",
  },
  {
    question: "Do you take a commission?",
    answer: "No. Inquiries come straight to you and the work you win is yours.",
  },
  {
    question: "My agency is already listed. What do I do?",
    answer:
      "Find it and claim it with an email at your agency's domain. Then choose Pro to manage it.",
  },
  {
    question: "What happens if I cancel Pro?",
    answer: `Monthly plans run to the end of the month you've paid for; yearly plans get a full refund if you ask within ${COMPANY.refunds.yearlyFullRefundDays} days of paying. When Pro ends, your listing stays public but unmanaged: businesses can't contact you and editing is locked. Past inquiries stay readable in your dashboard, and we keep your details for when you come back.`,
  },
  {
    question: "Can I pay to get the Verified badge?",
    answer: "No. Any agency can apply; it's only given when our checks pass.",
  },
];

export default async function PricingPage() {
  const { monthly } = await getProPrices();
  const getPro = cn(
    "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 font-semibold",
    focusRing,
  );

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      {/* Same text as the answers below. */}
      <JsonLd data={faqJsonLd(FAQS)} />

      {/* 1. Hero */}
      <section className="home-grid overflow-clip px-4 pt-8 pb-10 md:px-6 md:pb-14">
        <div className="mx-auto max-w-[1200px]">
          <Breadcrumbs items={breadcrumbs} />
        </div>
        <div className="mx-auto mt-10 flex max-w-[900px] flex-col items-center text-center md:mt-14">
          <p className="rounded-full border border-line bg-raised px-3.5 py-1 text-[14px] font-medium">
            For YouTube agencies
          </p>
          <h1 className="mt-6 text-[clamp(40px,6.2vw,76px)] leading-[1.02] font-[680] tracking-[-0.045em] text-balance">
            Be the agency they <span className="text-accent">find first.</span>
          </h1>
          <p className="mt-6 max-w-[36em] text-[clamp(17px,1.6vw,20px)] leading-normal text-text-2">
            Business owners come here looking for a YouTube agency in their industry. Pro puts you
            in front of them on Google, in AI answers and in our directory.
          </p>
          <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <a
              href="#plans"
              className={cn(getPro, "bg-accent text-on-accent hover:bg-(--accent-hover)")}
            >
              Get Pro for ${monthly}/month
            </a>
            <Link
              href="/list-your-agency#claim"
              className={cn(getPro, "border border-line bg-raised hover:border-text-2")}
            >
              Find your free listing
            </Link>
          </div>
          <p className="mt-4 text-[14px] text-text-2">
            No commission on work you win · Cancel anytime
          </p>
        </div>
      </section>

      {/* 2. How we bring you clients */}
      <section aria-labelledby="clients-heading">
        <div className={cn(shell, "flex flex-col gap-10")}>
          <div className="flex max-w-[680px] flex-col gap-3">
            <p className={eyebrow}>How we bring you clients</p>
            <h2 id="clients-heading" className={h2}>
              Show up where buyers are already looking
            </h2>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {CHANNELS.map(({ title, body, tint, Art }) => (
              <li
                key={title}
                className="flex flex-col gap-4 rounded-[22px] border border-line bg-raised p-4"
              >
                <div
                  aria-hidden
                  className={cn("flex h-48 items-center justify-center rounded-2xl p-5", tint)}
                >
                  <Art />
                </div>
                <div className="flex flex-col gap-1.5 px-2 pb-2">
                  <h3 className="text-[19px] font-[650]">{title}</h3>
                  <p className="text-[15.5px] text-text-2">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. Plans */}
      <section id="plans" aria-labelledby="plans-heading" className="scroll-mt-16">
        <div className={cn(shell, "flex flex-col items-center gap-10 text-center")}>
          <div className="flex max-w-[680px] flex-col items-center gap-3">
            <p className={eyebrow}>Plans</p>
            <h2 id="plans-heading" className={h2}>
              One plan. Every lead is yours.
            </h2>
            <p className="text-[17px] text-text-2">
              Listing is free. Pro is how you manage your profile and hear from the businesses that
              find you.
            </p>
          </div>
          <PlanColumns />
        </div>
      </section>

      {/* 4. Promise strip */}
      <section aria-label="Our promises" className={shell}>
        <ul className="grid gap-6 rounded-[28px] bg-accent-soft px-6 py-8 md:grid-cols-3 md:px-10">
          <li className="flex flex-col gap-1">
            <p className="text-[32px] font-[680] tracking-[-0.03em]">0%</p>
            <p className="font-semibold">Commission</p>
            <p className="text-[15px] text-text-2">
              The work you win is yours. We never take a cut.
            </p>
          </li>
          <li className="flex flex-col gap-1">
            <p className="text-[32px] font-[680] tracking-[-0.03em]">Anytime</p>
            <p className="font-semibold">Cancel</p>
            <p className="text-[15px] text-text-2">
              Monthly plans stop at the end of the month you&apos;ve paid for.
            </p>
          </li>
          <li className="flex flex-col gap-1">
            <p className="text-[32px] font-[680] tracking-[-0.03em]">
              {COMPANY.refunds.yearlyFullRefundDays} days
            </p>
            <p className="font-semibold">Full refund on yearly</p>
            <p className="text-[15px] text-text-2">
              Ask within {COMPANY.refunds.yearlyFullRefundDays} days of paying.{" "}
              <Link
                href="/refunds"
                className={cn("rounded text-accent hover:underline", focusRing)}
              >
                Refund policy
              </Link>
            </p>
          </li>
        </ul>
      </section>

      {/* 5. Fair for everyone */}
      <section aria-labelledby="fair-heading">
        <div className={cn(shell, "grid gap-8 md:grid-cols-2 md:gap-16")}>
          <div className="flex flex-col gap-3">
            <p className={eyebrow}>Fair for everyone</p>
            <h2 id="fair-heading" className={h2}>
              Buyers trust us. That&apos;s what makes your leads worth having.
            </h2>
          </div>
          <div className="flex flex-col gap-5 text-[16.5px] text-text-2">
            <p>
              <strong className="text-text">Rankings can&apos;t be bought.</strong> Pro and
              Sponsored change where you&apos;re shown, never your order among agencies on the same
              plan.
            </p>
            <p>
              <strong className="text-text">The Verified badge is earned.</strong> Any agency can
              apply, and it&apos;s only given when our checks of your website, business and channels
              pass.{" "}
              <Link
                href="/how-we-rank"
                className={cn("rounded text-accent hover:underline", focusRing)}
              >
                How we rank agencies
              </Link>
            </p>
            <p>
              <strong className="text-text">Paid spots are always labelled.</strong> Sponsored
              agencies carry a Sponsored label, so buyers know exactly what they&apos;re looking at.
            </p>
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
      <section aria-labelledby="faq-heading">
        <div
          className={cn(shell, "grid gap-10 min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}
        >
          <div className="flex flex-col gap-3">
            <p className={eyebrow}>FAQ</p>
            <h2 id="faq-heading" className={h2}>
              Questions agencies ask
            </h2>
            <p className="text-[17px] text-text-2">
              Something else?{" "}
              <Link
                href="/contact?topic=agencies"
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

      {/* 7. Closing band */}
      <section aria-labelledby="closing-heading" className={shell}>
        <div className="flex flex-col items-center gap-5 rounded-[28px] bg-[#16171a] px-6 py-14 text-center text-white md:py-20 site-dark:border site-dark:border-line site-dark:bg-raised">
          <h2 id="closing-heading" className={cn(h2, "max-w-[18em]")}>
            Your next client is already searching.
          </h2>
          <p className="text-[17px] text-white/75">
            Set up your profile in a few minutes. ${monthly}/month, cancel anytime.
          </p>
          <a
            href="#plans"
            className="mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-[#16171a] transition-transform duration-150 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Get Pro
            <ArrowRight className="size-5 [stroke-width:2]" aria-hidden />
          </a>
        </div>
      </section>
    </>
  );
}
