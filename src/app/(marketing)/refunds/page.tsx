import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { paymentsEnabled } from "@/lib/billing";
import { COMPANY } from "@/lib/company";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

// Refund rules for paid plans and sponsored places. Rules come from lib/company.ts.
export const revalidate = 3600;

const UPDATED = "2026-10-07";
const TITLE = "Refund policy";
const DESCRIPTION =
  "How cancellations and refunds work for YT Agencies paid plans and sponsored places: monthly and yearly plans, sponsored page slots, and how to request a refund.";

export const metadata = buildMetadata({
  title: `Refund policy | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/refunds",
});

const days = COMPANY.refunds.yearlyFullRefundDays;
const agencies = COMPANY.emails.agencies;
const provider = COMPANY.paymentProvider ?? "our payment provider";

const sections: LegalSection[] = [
  {
    id: "monthly-plans",
    title: "Monthly plans",
    body: (
      <p>
        You can cancel a monthly plan at any time. You keep your plan until the end of the period
        you&apos;ve paid for, and it doesn&apos;t renew after that. We don&apos;t refund part of a
        month.
      </p>
    ),
  },
  {
    id: "yearly-plans",
    title: "Yearly plans",
    body: (
      <p>
        If you ask within {days} days of buying a yearly plan, we refund it in full. After {days}{" "}
        days you can cancel so it doesn&apos;t renew, and you keep the plan until the end of the
        year you&apos;ve paid for.
      </p>
    ),
  },
  {
    id: "sponsored-places",
    title: "Sponsored places",
    body: (
      <p>
        If you cancel a sponsored place before its start date, we refund it in full. Once it has
        started, we don&apos;t refund it.
      </p>
    ),
  },
  {
    id: "founding-programme",
    title: "Founding programme",
    body: (
      <p>
        Founding agencies get paid-plan features for free for a set time, so there&apos;s nothing to
        refund. When the free period ends, the agency moves to the free plan unless it chooses a
        paid one.
      </p>
    ),
  },
  {
    id: "how-to-ask",
    title: "How to ask for a refund",
    body: (
      <p>
        Email <a href={`mailto:${agencies}`}>{agencies}</a> from the address on your account, or use
        the <Link href="/contact?topic=agencies">contact form</Link>, with your agency name and what
        you&apos;d like refunded.
        {COMPANY.responseTimes.agencies ? ` We reply ${COMPANY.responseTimes.agencies}.` : ""}
      </p>
    ),
  },
  {
    id: "who-processes-refunds",
    title: "Who processes refunds",
    body: (
      <p>
        Our plans are sold through {provider}, which acts as the merchant of record: it takes the
        payment, handles tax and sends the refund back to your original payment method. How quickly
        the money arrives depends on your bank or card issuer.
      </p>
    ),
  },
];

export default function RefundsPage() {
  const live = paymentsEnabled();
  return (
    <LegalPage
      title={TITLE}
      description={DESCRIPTION}
      path="/refunds"
      updated={UPDATED}
      contactEmail={agencies}
      summary={[
        "Monthly plans: cancel any time and keep the plan until the period ends. No partial refunds.",
        `Yearly plans: a full refund if you ask within ${days} days of buying.`,
        "Sponsored places: a full refund if cancelled before the start date, none after.",
        "Listing an agency is free, so most agencies never pay anything.",
      ]}
      sections={sections}
    >
      {!live && (
        <p className="rounded-2xl border border-line px-6 py-4 text-[16px] text-text-2">
          Paid plans aren&apos;t on sale yet. During launch, agencies can join the{" "}
          <Link href="/for-agencies/pricing" className="text-accent underline underline-offset-2">
            Founding programme
          </Link>{" "}
          for free. This policy applies once paid plans are available.
        </p>
      )}
    </LegalPage>
  );
}
