import { EmailLayout, link, muted, text } from "@/emails/layout";

// Pro billing emails to the agency owner (lib/billing/creem.ts, lib/billing/notices.tsx). Creem,
// as merchant of record, sends the receipt and invoices itself; these link to our Billing page.

type Props = { agencyName: string; billingUrl: string };

export function ProStartedEmail({ agencyName, billingUrl }: Props) {
  return (
    <EmailLayout preview={`${agencyName} is on Pro`}>
      <p style={text}>
        You&apos;re on Pro. {agencyName}&apos;s listing is now managed: businesses can contact you
        from your profile, Get matched sends you requests that fit, and you can edit your listing
        any time.
      </p>
      <p style={text}>
        Your receipt comes from Creem, our payment provider, in a separate email. Your plan, renewal
        date and invoices are on your{" "}
        <a href={billingUrl} style={link}>
          Billing page
        </a>
        .
      </p>
    </EmailLayout>
  );
}

export function PaymentFailedEmail({ agencyName, billingUrl }: Props) {
  return (
    <EmailLayout preview="Payment failed: update your card">
      <p style={text}>
        We couldn&apos;t take the payment for {agencyName}&apos;s Pro plan. Creem will try again
        over the next few days.
      </p>
      <p style={text}>
        Pro stays on for 7 days. To keep it after that,{" "}
        <a href={billingUrl} style={link}>
          update your card
        </a>{" "}
        (Billing → Manage billing).
      </p>
    </EmailLayout>
  );
}

export function ProEndingEmail({ agencyName, billingUrl, endsOn }: Props & { endsOn: string }) {
  return (
    <EmailLayout preview={`Pro ends on ${endsOn}`}>
      <p style={text}>
        {agencyName}&apos;s Pro plan ends on {endsOn}, in 3 days. After that your listing stays
        public but unmanaged: businesses can&apos;t contact you and editing is locked. We keep your
        details.
      </p>
      <p style={text}>
        Changed your mind?{" "}
        <a href={billingUrl} style={link}>
          Keep Pro
        </a>{" "}
        from your Billing page.
      </p>
    </EmailLayout>
  );
}

export function ProEndedEmail({ agencyName, billingUrl }: Props) {
  return (
    <EmailLayout preview="Your Pro plan has ended">
      <p style={text}>
        Your Pro plan for {agencyName} has ended. Your listing stays public but unmanaged:
        businesses can&apos;t contact you through it and editing is locked. We&apos;ve kept your
        details.
      </p>
      <p style={text}>
        <a href={billingUrl} style={link}>
          Renew Pro
        </a>{" "}
        to manage it again.
      </p>
      <p style={muted}>If you didn&apos;t expect this, reply to this email.</p>
    </EmailLayout>
  );
}
