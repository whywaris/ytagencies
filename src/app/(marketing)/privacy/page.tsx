import { LegalPage } from "@/components/legal-page";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/site";

// LAUNCH: describes what the code actually collects, but have it reviewed for your jurisdiction
// (e.g. GDPR/UK GDPR if you serve the UK/EU) before launch, and keep it in sync with the code.

export const metadata = buildMetadata({
  title: `Privacy policy | ${BRAND_NAME}`,
  description: `What ${BRAND_NAME} collects when you search for an agency, send an inquiry or manage a listing, who we share it with, and how to have your details deleted.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" path="/privacy" updated="October 4, 2026">
      <p>
        {BRAND_NAME} helps businesses find YouTube agencies. This page explains what we collect,
        why, and what you can ask us to do with it.
      </p>

      <h2>When you browse</h2>
      <p>
        You can search and read agency listings without an account. We use Vercel Analytics to count
        visits and see which pages are used. It doesn&apos;t use cookies to track you across sites.
      </p>

      <h2>When you send an inquiry or get matched</h2>
      <p>We collect what we need to connect you with agencies:</p>
      <ul>
        <li>Your name and email address</li>
        <li>Your company name, if you give it</li>
        <li>The service, industry and budget range you choose</li>
        <li>Your message</li>
      </ul>
      <p>
        We send these details to the agency you contact, or to up to three agencies we match you
        with, so they can reply to you. We email you a confirmation, and our team sees each request
        so we can follow up when no agency matches. We don&apos;t sell your details or add you to a
        mailing list.
      </p>

      <h2>When you manage a listing</h2>
      <p>
        Agencies sign in with an email link or Google. We store your email address, the work email
        you use to claim a listing, and the listing details you edit. Inquiries sent to your agency
        are shown in your dashboard.
      </p>

      <h2>Spam protection</h2>
      <p>
        Our forms use Cloudflare Turnstile to block bots. To limit abuse we keep a one-way hash of
        your IP address and email address for about an hour. We can&apos;t turn it back into the
        original.
      </p>

      <h2>Who processes your data for us</h2>
      <ul>
        <li>Supabase: database, sign-in and file storage</li>
        <li>Vercel: hosting and analytics</li>
        <li>Resend: sending emails</li>
        <li>Cloudflare: Turnstile bot protection</li>
      </ul>

      <h2>Deleting your details</h2>
      <p>
        To have your inquiry or account deleted, reply to any email from us or write to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>
        . We delete it from our systems and ask the agencies that received it to delete their copy.
      </p>
    </LegalPage>
  );
}
