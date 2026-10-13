import { Check, Eye, MessageSquare } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgencyLogo } from "@/components/agency-logo";
import { ChoosePro, ClaimStep, RequestAccessForm } from "@/components/forms/claim-form";
import { btnPrimary } from "@/components/forms/claim-ui";
import { getProPrices } from "@/components/plan-columns";
import { getUser } from "@/lib/auth";
import { checkoutAvailable } from "@/lib/billing";
import { profileViews, requestsThisMonth, strengthInput } from "@/lib/data/agency-stats";
import { getAgencyBySlug } from "@/lib/data/agencies";
import { getIndustryBySlug, getServiceBySlug } from "@/lib/data/taxonomy";
import { liveSubscription } from "@/lib/entitlements";
import { profileStrength } from "@/lib/profile-strength";
import { absoluteUrl, BRAND_NAME } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { yearlySaving } from "@/lib/pricing";

// /claim/<slug> (docs/mockups/claim.html, without the Founding card). One page for every step:
// 1 sign in, 2 confirm a work email (domain match = a link; otherwise proof an admin reviews),
// 3 choose Pro. Ownership is recorded after step 2; management turns on only after payment.
// Someone else manages it: request access. Owner on Pro: the welcome screen.

export async function generateMetadata({ params }: PageProps<"/claim/[slug]">) {
  const agency = await getAgencyBySlug((await params).slug);
  return {
    title: { absolute: `Manage ${agency?.name ?? "a listing"} | ${BRAND_NAME}` },
    robots: { index: false, follow: false },
  };
}

const count = new Intl.NumberFormat("en-US");
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
const hostOf = (website: string | null) => {
  try {
    return website ? new URL(website).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};
const h1 = "text-[26px] leading-tight font-[650] tracking-[-0.03em]";
const sub = "mt-1.5 text-[15px] text-text-2";

export default async function ClaimPage({ params, searchParams }: PageProps<"/claim/[slug]">) {
  const { slug } = await params;
  const agency = await getAgencyBySlug(slug);
  if (!agency) notFound();
  const paid = (await searchParams).status === "success";

  const user = await getUser();
  const admin = createAdminClient();
  const primaryService = agency.services[0];
  const primaryIndustry = agency.industries[0];
  const [owner, subs, views, service, industry, prices] = await Promise.all([
    admin.from("agencies").select("owner_id").eq("id", agency.id).single(),
    admin
      .from("agency_subscriptions")
      .select("plan_id, status, starts_at, ends_at, cancel_at_period_end, past_due_since")
      .eq("agency_id", agency.id),
    profileViews([agency.id]),
    primaryService ? getServiceBySlug(primaryService.slug) : null,
    primaryIndustry ? getIndustryBySlug(primaryIndustry.slug) : null,
    getProPrices(),
  ]);
  const ownerId = owner.data?.owner_id ?? null;
  const mine = !!user && ownerId === user.id;
  const live = liveSubscription(subs.data ?? []);
  const viewed = views.get(agency.id) ?? 0;
  const asked = service && industry ? await requestsThisMonth(service.id, industry.id) : 0;

  // Their own pending claim, if any (RLS: users read only their own claims).
  const pending =
    user && !ownerId
      ? (
          await (
            await createClient()
          )
            .from("claims")
            .select("work_email, role")
            .eq("agency_id", agency.id)
            .eq("user_id", user.id)
            .eq("status", "pending")
            .maybeSingle()
        ).data
      : null;

  if (mine && live) {
    const strength = profileStrength(await strengthInput(agency.id));
    return (
      <Glow>
        <div className="mx-auto max-w-[720px] px-4 pt-14 pb-22 md:px-6">
          <span className="mb-[18px] grid size-[60px] place-items-center rounded-[18px] bg-(--mint-soft) text-(--mint)">
            <Check className="size-7 [stroke-width:2.5]" aria-hidden />
          </span>
          <h1 className="text-[clamp(30px,4vw,40px)] leading-tight font-[650] tracking-[-0.035em]">
            {agency.name} is yours
          </h1>
          <p className="mt-2.5 text-[17px] text-text-2">
            {live.ends_at ? `You're on Pro until ${longDate(live.ends_at)}.` : "You're on Pro."}{" "}
            Businesses can now contact you, and you can edit your profile.
          </p>
          <section
            aria-labelledby="strength-h"
            className="mt-7 rounded-[20px] border border-line bg-raised p-[22px]"
          >
            <div className="flex items-baseline justify-between">
              <h2 id="strength-h" className="text-[17px] font-[650]">
                Finish your profile
              </h2>
              <b className="text-[22px] font-[650] tabular-nums">{strength.percent}%</b>
            </div>
            <div
              role="progressbar"
              aria-label="Profile strength"
              aria-valuenow={strength.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 mb-2 h-2.5 overflow-hidden rounded-full bg-surface"
            >
              <i
                className="block h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--violet))]"
                style={{ width: `${strength.percent}%` }}
              />
            </div>
            <p className="text-[13px] text-text-2">Complete profiles rank higher.</p>
            <ul className="mt-3 grid gap-2 text-[14px]">
              {strength.items
                .filter((i) => !i.done)
                .slice(0, 4)
                .map((i) => (
                  <li key={i.key} className="flex justify-between gap-2.5">
                    {i.label}
                    <span className="text-[13px] font-semibold text-(--mint)">+{i.gain}%</span>
                  </li>
                ))}
            </ul>
            {strength.percent < 100 && (
              <Link
                href={`/dashboard/${agency.slug}/profile`}
                className={cn(btnPrimary, "mt-[18px]")}
              >
                Complete profile
              </Link>
            )}
          </section>
          <p className="mt-[22px] text-[14px]">
            <Link
              href={`/dashboard/${agency.slug}`}
              className="font-semibold text-accent hover:underline"
            >
              Go to your dashboard
            </Link>{" "}
            ·{" "}
            <Link
              href={`/dashboard/${agency.slug}/inquiries`}
              className="font-semibold text-accent hover:underline"
            >
              See your inquiries
            </Link>
          </p>
        </div>
      </Glow>
    );
  }

  const step = !user ? 1 : mine ? 3 : 2;
  const steps = [
    {
      n: 1,
      title: user ? "Signed in" : "Sign in",
      detail: user?.email ?? "With an email link or Google.",
    },
    {
      n: 2,
      title: mine ? "Work email confirmed" : "Confirm your work email",
      detail: hostOf(agency.website)
        ? `A link to an address on ${hostOf(agency.website)}, or proof we check by hand.`
        : "Proof we check by hand.",
    },
    { n: 3, title: "Choose Pro", detail: "Monthly or yearly. Pro turns on inquiries and editing." },
  ];

  let card: React.ReactNode;
  if (ownerId && !mine) {
    card = (
      <>
        <h1 className={h1}>This listing is already managed</h1>
        <p className={sub}>
          Someone confirmed they work at {agency.name}. If you work there too, ask for access.
        </p>
        {user ? (
          <>
            <p className="mt-[18px] rounded-2xl bg-surface p-4 text-[14px] text-text-2">
              We&apos;ll contact the current manager and the agency. If they don&apos;t reply within
              5 business days, we review your request ourselves.
            </p>
            <RequestAccessForm agencySlug={agency.slug} />
          </>
        ) : (
          <Link href={`/login?next=/claim/${agency.slug}`} className={cn(btnPrimary, "mt-[18px]")}>
            Sign in to request access
          </Link>
        )}
      </>
    );
  } else {
    card = (
      <>
        <h1 className={h1}>{mine ? `Manage ${agency.name} with Pro` : `Claim ${agency.name}`}</h1>
        <p className={sub}>
          {mine
            ? "The listing is yours. Choose Pro to receive inquiries and edit it."
            : "Confirm you work there. It takes a minute."}
        </p>
        <ol className="mt-[22px] grid gap-1">
          {steps.map((s) => (
            <li
              key={s.n}
              aria-current={s.n === step ? "step" : undefined}
              className="flex items-start gap-3 py-2.5"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-[26px] shrink-0 place-items-center rounded-full text-[12.5px] font-[650]",
                  s.n < step
                    ? "bg-(--mint) text-white"
                    : s.n === step
                      ? "bg-accent text-on-accent"
                      : "bg-surface",
                )}
              >
                {s.n < step ? <Check className="size-3.5 [stroke-width:3]" /> : s.n}
              </span>
              <div>
                <b className="block text-[15px]">
                  <span className="sr-only">{s.n < step ? "Done: " : `Step ${s.n}: `}</span>
                  {s.title}
                </b>
                <span className="text-[13.5px] text-text-2">{s.detail}</span>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-2">
          {!user ? (
            <Link href={`/login?next=/claim/${agency.slug}`} className={btnPrimary}>
              Sign in to continue
            </Link>
          ) : mine ? (
            paid ? (
              <p role="status" className="rounded-2xl bg-surface p-4 text-[14px]">
                Payment received. Pro turns on as soon as Creem confirms it, usually within a
                minute.{" "}
                <Link
                  href={`/claim/${agency.slug}?status=success`}
                  className="font-semibold text-accent hover:underline"
                >
                  Refresh
                </Link>
              </p>
            ) : (
              <ChoosePro
                agencyId={agency.id}
                agencyUrl={absoluteUrl(`/agency/${agency.slug}`)}
                monthly={prices.monthly}
                yearly={prices.yearly}
                saving={yearlySaving(prices.monthly, prices.yearly)}
                live={checkoutAvailable()}
              />
            )
          ) : pending ? (
            <p role="status" className="rounded-2xl bg-surface p-4 text-[14px]">
              {pending.role
                ? "We're checking your proof by hand and will email you within 2 business days."
                : `Your claim with ${pending.work_email} is open. Open the link we emailed you, or wait for our review.`}
            </p>
          ) : (
            <ClaimStep
              agencySlug={agency.slug}
              agencyName={agency.name}
              domain={hostOf(agency.website)}
              signedInAs={user.email ?? ""}
            />
          )}
        </div>
      </>
    );
  }

  const location = [agency.hqCity, agency.hqCountry].filter(Boolean).join(", ");
  return (
    <Glow>
      <div className="mx-auto grid max-w-[560px] items-start gap-7 px-4 pt-8 pb-16 min-[920px]:max-w-[1040px] min-[920px]:grid-cols-[minmax(0,1fr)_minmax(0,460px)] min-[920px]:gap-14 min-[920px]:px-6 min-[920px]:pt-14 min-[920px]:pb-22">
        <div>
          <Link
            href="/list-your-agency"
            className="mb-[18px] inline-flex text-[14px] text-text-2 hover:text-text"
          >
            ← Back to search
          </Link>
          <div className="rounded-[22px] border border-line bg-raised p-[22px]">
            <div className="flex items-center gap-3.5">
              <AgencyLogo name={agency.name} logoPath={agency.logoPath} />
              <div className="min-w-0">
                <Link
                  href={`/agency/${agency.slug}`}
                  className="block truncate text-[20px] font-semibold tracking-[-0.02em] hover:underline"
                >
                  {agency.name}
                </Link>
                {hostOf(agency.website) && (
                  <span className="text-[13.5px] text-text-2">{hostOf(agency.website)}</span>
                )}
              </div>
            </div>
            <dl className="mt-[18px]">
              {[
                ["Services", agency.services.map((s) => s.name).join(", ")],
                ["Industries", agency.industries.map((i) => i.name).join(", ")],
                ["Location", location],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-3 border-t border-line-2 py-2.5 text-[14px]"
                  >
                    <dt className="text-text-2">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
            </dl>
            {(viewed > 0 || asked > 0) && (
              <ul className="mt-4 grid gap-2">
                {viewed > 0 && (
                  <li className="flex items-center gap-3 rounded-2xl bg-(--accent-soft) px-4 py-3 text-[14px]">
                    <Eye className="size-5 shrink-0 text-(--accent-on-soft)" aria-hidden />
                    <span>
                      <b className="tabular-nums">{count.format(viewed)}</b>{" "}
                      {viewed === 1 ? "business" : "businesses"} viewed this profile in the last 30
                      days
                    </span>
                  </li>
                )}
                {asked > 0 && service && industry && (
                  <li className="flex items-center gap-3 rounded-2xl bg-(--coral-soft) px-4 py-3 text-[14px]">
                    <MessageSquare className="size-5 shrink-0 text-(--coral-on-soft)" aria-hidden />
                    <span>
                      <b className="tabular-nums">{count.format(asked)}</b>{" "}
                      {asked === 1 ? "business" : "businesses"} asked for {service.name} agencies in{" "}
                      {industry.name.toLowerCase()} this month
                    </span>
                  </li>
                )}
              </ul>
            )}
          </div>
          <div className="mt-[22px]">
            <h2 className="mb-2.5 text-[15px] font-[650]">With Pro, you can</h2>
            <ul className="grid gap-2 text-[14.5px] text-text-2">
              {[
                "Fix anything we got wrong",
                "Add your pricing, channels and case studies",
                "Receive inquiries and see who views your profile",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check
                    className="mt-1 size-4 shrink-0 [stroke-width:2.5] text-(--mint)"
                    aria-hidden
                  />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div
          aria-live="polite"
          className="rounded-[24px] border border-line bg-raised p-[22px] shadow-[0_1px_2px_rgba(20,25,40,.05),0_12px_32px_-12px_rgba(20,25,40,.16)] sm:p-[30px]"
        >
          {card}
        </div>
      </div>
      {mine && !live && (
        <p className="pb-10 text-center text-[14px] text-text-2">
          Not now?{" "}
          <Link
            href={`/dashboard/${agency.slug}`}
            className={cn("font-semibold text-accent hover:underline")}
          >
            Go to your dashboard
          </Link>
        </p>
      )}
    </Glow>
  );
}

function Glow({ children }: { children: React.ReactNode }) {
  return (
    <div className="home-hero relative isolate min-h-[calc(100vh-100px)] overflow-clip">
      <div
        aria-hidden
        className="home-hero-glow pointer-events-none absolute [inset:-20%_-10%_0_-10%] -z-10 blur-[60px]"
      />
      {children}
    </div>
  );
}
