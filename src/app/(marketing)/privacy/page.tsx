import Link from "next/link";

import { CookieSettingsButton } from "@/components/analytics";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/site";
import { PAGE_UPDATED } from "@/lib/page-dates";

// Describes exactly what the code collects today. Keep it in sync with the code: forms
// (lib/actions), the analytics beacon (api/events), Google Analytics (components/analytics.tsx,
// after consent), sign-in (Supabase) and emails (Resend). LAUNCH: have it reviewed for your jurisdiction before launch.

const UPDATED = PAGE_UPDATED["/privacy"];
const TITLE = "Privacy policy";
const DESCRIPTION =
  "What YT Agencies collects when you browse, send an inquiry or manage a listing, who receives it, how long we keep it, and how to get a copy or have it deleted.";

export const metadata = buildMetadata({
  title: `Privacy policy | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/privacy",
});

const operator = COMPANY.legalName ? `${COMPANY.legalName}, trading as ${BRAND_NAME}` : BRAND_NAME;
const email = COMPANY.email;

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <p>
        {operator} runs {SITE_DOMAIN}
        {COMPANY.city && COMPANY.country ? `, from ${COMPANY.city}, ${COMPANY.country}` : ""}. We
        decide what personal data the site collects and why, so for data protection law we are the
        controller. You can reach us about anything on this page at{" "}
        <a href={`mailto:${email}`}>{email}</a>.
      </p>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <h3>When you browse</h3>
        <p>
          You can read the directory and guides without an account. Vercel Web Analytics counts page
          views without cookies and without identifying you.
        </p>
        <p>
          Only if you accept analytics cookies, Google Analytics records how the public pages are
          used: the pages you view, roughly where you are (country and city from your IP address,
          which Google doesn&apos;t store), your device and browser, how you arrived, and a few
          actions such as sending an inquiry form, with no names, emails, messages or search text.
          It sets the cookies listed in our <Link href="/cookies">cookie policy</Link>. Until you
          accept, and if you decline, it stores nothing in your browser. It never runs in the agency
          dashboard, the claim pages, sign-in or admin. We don&apos;t use Google Analytics for
          signed-in users.
        </p>
        <p>
          When you view an agency&apos;s profile, open its contact form or click its website link,
          we record that event so the agency can see how its profile is doing. We store a visitor
          code made from your IP address and browser with a key that changes every day, so we
          can&apos;t recognise you from one day to the next. We don&apos;t store your IP address or
          browser details.
        </p>
        <h3>When you request a quote or request proposals</h3>
        <ul>
          <li>Your name and email address</li>
          <li>Your company name, if you give it</li>
          <li>The service, niche, budget range, timeline, goal and country you choose</li>
          <li>Your message</li>
          <li>On a quote request, your agreement to the 48-hour fallback below</li>
        </ul>
        <h3>When you write to us</h3>
        <p>
          The contact form collects your name, email address, the topic, your message and, if you
          report a listing, the link to it.
        </p>
        <h3>When you manage a listing</h3>
        <ul>
          <li>
            Your email address, which you use to sign in with an email link, or your Google account
            name and email address if you sign in with Google
          </li>
          <li>The work email you use to claim a listing</li>
          <li>The listing details, logo and case studies you add</li>
          <li>YouTube channel links you give us for verification, and their public statistics</li>
        </ul>
        <p>Our sign-in provider keeps records of sign-ins, including IP addresses, for security.</p>
        <h3>To stop spam</h3>
        <p>
          To limit abuse of our forms, we keep a one-way hash of your IP address and email address
          for about an hour. It can&apos;t be turned back into
          the original.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use it",
    body: (
      <>
        <ul>
          <li>
            <strong>To deliver your request</strong> to the agency you chose, or to up to three
            agencies that match it, and to email you a confirmation. If the agency you chose
            doesn&apos;t reply within 48 hours, we send it to up to three similar agencies and tell
            you who. We do this because you asked us to.
          </li>
          <li>
            <strong>To run your agency account</strong>: sign-in, your listing, your inquiries and
            your profile statistics. This is needed to provide the service.
          </li>
          <li>
            <strong>To answer messages</strong> you send through the contact form.
          </li>
          <li>
            <strong>To keep the site safe</strong>: blocking bots, limiting repeated requests and
            reviewing listings and reviews before they go live. This is in our legitimate interest
            and yours.
          </li>
        </ul>
        <p>
          We don&apos;t sell your data, show ads or build advertising profiles. We don&apos;t add
          you to a mailing list.
        </p>
      </>
    ),
  },
  {
    id: "who-receives-it",
    title: "Who receives it",
    body: (
      <>
        <p>
          <strong>Agencies.</strong> Agencies on a Pro plan that receive your request see your name,
          email, company and message so they can reply to you; once they have it, they handle it
          under their own privacy policy. Agencies not on Pro see only a preview: the service,
          niche, budget range, timeline, goal, country and a short summary of your message with
          names, emails, phone numbers and links removed. If the agency hasn&apos;t claimed its
          listing, we email the address we hold for it that it has a request, with no details of
          it.
        </p>
        <p>
          <strong>Service providers</strong> that process data for us, under their data processing
          terms:
        </p>
        <ul>
          <li>Supabase: database, sign-in and file storage</li>
          <li>Vercel: hosting and analytics</li>
          <li>
            Google Analytics: website statistics, only after you accept analytics cookies. Google
            keeps this data for up to 14 months.
          </li>
          <li>Resend: sending emails</li>
          <li>Cloudflare: image hosting</li>
          <li>
            Google: sign-in with Google, if you choose it, and the YouTube Data API, which receives
            channel links during verification
          </li>
        </ul>
        <p>
          Lemon Squeezy sells Pro as merchant of record: it processes payment details, your billing address
          and tax information, and sends receipts. We receive your email, Lemon Squeezy customer and
          subscription ids and the plan&apos;s status, never card numbers.
        </p>
      </>
    ),
  },
  {
    id: "how-long-we-keep-it",
    title: "How long we keep it",
    body: (
      <ul>
        <li>
          <strong>Inquiries:</strong> {COMPANY.retention.leadsMonths} months, then they&apos;re
          deleted automatically, with the record of which agencies received them. You can ask us to
          delete yours sooner.
        </li>
        <li>
          <strong>Contact messages:</strong> {COMPANY.retention.closedMessagesMonths} months after
          we close them, then they&apos;re deleted automatically. You can ask us to delete yours
          sooner.
        </li>
        <li>
          <strong>Agency accounts and listings:</strong> until you ask us to close the account.
        </li>
        <li>
          <strong>Profile events:</strong> individual events for 90 days; after that only daily
          totals per agency, with no visitor codes.
        </li>
        <li>
          <strong>Spam-protection hashes:</strong> about an hour.
        </li>
        <li>
          <strong>Emails:</strong> our email provider keeps delivery records for a limited time
          under its own policy.
        </li>
      </ul>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights and how to use them",
    body: (
      <>
        <p>
          You can ask for a copy of your data, ask us to correct or delete it, or object to how we
          use it. Write to <a href={`mailto:${email}`}>{email}</a> or use the{" "}
          <Link href="/contact?topic=privacy">privacy request form</Link>. We answer{" "}
          {COMPANY.responseTimes.privacy}.
        </p>
        <p>
          You can withdraw your consent to analytics cookies at any time with{" "}
          <CookieSettingsButton className="font-medium text-accent underline underline-offset-2" />{" "}
          (also in the footer): choose Decline, and clear the <code>_ga</code> cookies in your
          browser if you like.
        </p>
        <p>
          We may ask you to confirm the request from the email address it concerns. When we delete
          an inquiry, we also ask the agencies that received it to delete their copy.
        </p>
        <p>
          If you&apos;re unhappy with how we handled your data, you can complain to your local data
          protection authority.
        </p>
      </>
    ),
  },
  {
    id: "international-transfers",
    title: "International transfers",
    body: (
      <p>
        Our service providers are based in the United States and process data there and in other
        countries. We rely on the safeguards in their data processing terms, such as the European
        Commission&apos;s standard contractual clauses, for transfers out of the UK and EU.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        The site only works over HTTPS. Database access is limited by row-level rules, so visitors
        and agencies can only see what they should, and only our administrators can see inquiries
        and messages. No system is perfect, so please tell us at{" "}
        <a href={`mailto:${email}`}>{email}</a> if you find a problem.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        {BRAND_NAME} is for businesses and isn&apos;t meant for anyone under 18. If you think a
        child has sent us their details, write to us and we&apos;ll delete them.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        When we change what we collect or how we use it, we update this page and the date at the
        top.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title={TITLE}
      description={DESCRIPTION}
      path="/privacy"
      updated={UPDATED}
      contactEmail={email}
      summary={[
        "We collect what's needed to connect businesses with agencies: your details when you send an inquiry, write to us or manage a listing.",
        "Your contact details go only to Pro agencies you send a request to or are matched with; others see a preview without them. We don't sell your data or show ads.",
        "No advertising cookies. Google Analytics cookies are set only if you accept them, and you can change your mind any time.",
        `You can ask for a copy of your data or have it deleted at any time: ${email}.`,
      ]}
      sections={sections}
    />
  );
}
