import Link from "next/link";

import { CookieSettingsButton } from "@/components/analytics";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/site";
import { PAGE_UPDATED } from "@/lib/page-dates";

// Describes exactly what the code collects today. Keep it in sync with the code: the contact form
// (lib/actions/contact.tsx), Google Analytics (components/analytics.tsx, after consent), ads
// (lib/ads.ts), admin sign-in (Supabase) and emails (Resend). LAUNCH: have it reviewed for your jurisdiction before launch.

const UPDATED = PAGE_UPDATED["/privacy"];
const TITLE = "Privacy policy";
const DESCRIPTION =
  "What YT Agencies collects when you read the site or write to us, who receives it, how long we keep it, and how to get a copy or have it deleted.";

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
        <h3>When you read the site</h3>
        <p>
          You can read every guide without an account. Vercel Web Analytics counts page views
          without cookies and without identifying you.
        </p>
        <p>
          Only if you accept analytics cookies, Google Analytics records how the pages are used: the
          pages you view, roughly where you are (country and city from your IP address, which Google
          doesn&apos;t store), your device and browser and how you arrived, with no names, emails or
          messages. It sets the cookies listed in our <Link href="/cookies">cookie policy</Link>.
          Until you accept, and if you decline, it stores nothing in your browser. It never runs in
          sign-in or admin.
        </p>
        <h3>When you write to us</h3>
        <p>The contact form collects your name, email address, the topic and your message.</p>
        <h3>To stop spam</h3>
        <p>
          To limit abuse of the form, we keep a one-way hash of your IP address and email address
          for about an hour. It can&apos;t be turned back into the original.
        </p>
        <h3>Our own team</h3>
        <p>
          Only our administrators sign in. Our sign-in provider keeps records of sign-ins, including
          IP addresses, for security.
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
            <strong>To answer messages</strong> you send through the contact form, and to email you
            a copy.
          </li>
          <li>
            <strong>To understand which guides help</strong>, with the analytics above.
          </li>
          <li>
            <strong>To keep the site safe</strong>: blocking bots and limiting repeated messages.
            This is in our legitimate interest and yours.
          </li>
        </ul>
        <p>We don&apos;t sell your data, and we don&apos;t add you to a mailing list.</p>
      </>
    ),
  },
  {
    id: "who-receives-it",
    title: "Who receives it",
    body: (
      <>
        <p>
          <strong>Service providers</strong> that process data for us, under their data processing
          terms:
        </p>
        <ul>
          <li>Supabase: database and admin sign-in</li>
          <li>Vercel: hosting and analytics</li>
          <li>
            Google Analytics: website statistics, only after you accept analytics cookies. Google
            keeps this data for up to 14 months.
          </li>
          <li>Google AdSense: ads (see Advertising below)</li>
          <li>Resend: sending emails</li>
          <li>Cloudflare: image hosting</li>
        </ul>
      </>
    ),
  },
  {
    id: "advertising",
    title: "Advertising",
    body: (
      <>
        <p>
          We may show ads on our guides through Google AdSense. Google and its partners can use
          cookies to show and measure ads, including ads based on your earlier visits to this and
          other sites. They receive your browser&apos;s data directly, never anything you send us
          through the contact form. Ads never decide what we write.
        </p>
        <p>
          In the EEA, the UK and Switzerland, Google asks for your consent first. Elsewhere, you can
          turn off personalized ads in{" "}
          <a href="https://adssettings.google.com">Google&apos;s ad settings</a>. Google explains{" "}
          <a href="https://policies.google.com/technologies/partner-sites">
            how it uses data from sites that use its services
          </a>
          .
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
          <strong>Contact messages:</strong> {COMPANY.retention.closedMessagesMonths} months after
          we close them, then they&apos;re deleted automatically. You can ask us to delete yours
          sooner.
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
        <p>We may ask you to confirm the request from the email address it concerns.</p>
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
        can only see what they should, and only our administrators can see messages. No system is
        perfect, so please tell us at <a href={`mailto:${email}`}>{email}</a> if you find a problem.
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
        "We collect what's needed to answer you: your name, email and message when you write to us.",
        "We don't sell your data. Google Analytics cookies are set only if you accept them, and you can change your mind any time.",
        "Our pages may show Google ads, which can use cookies. In the EEA, the UK and Switzerland, Google asks for your consent first.",
        `You can ask for a copy of your data or have it deleted at any time: ${email}.`,
      ]}
      sections={sections}
    />
  );
}
