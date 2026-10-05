import { LegalPage } from "@/components/legal-page";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/site";

// LAUNCH: plain-language starting point only. Have it reviewed and add your company's legal name,
// governing law and liability terms before launch.

export const metadata = buildMetadata({
  title: `Terms of use | ${BRAND_NAME}`,
  description: `Terms for using ${BRAND_NAME}: how the directory works, what agencies agree to when they list, how paid Featured placements are labeled, and review moderation.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" path="/terms" updated="October 4, 2026">
      <p>By using {BRAND_NAME} you agree to these terms.</p>

      <h2>What we do</h2>
      <p>
        {BRAND_NAME} is a directory of YouTube agencies. Businesses can browse, compare and contact
        agencies for free. We don&apos;t provide agency services ourselves and aren&apos;t a party
        to any agreement you make with an agency. Check an agency&apos;s terms, pricing and
        references before you hire them.
      </p>

      <h2>Listings</h2>
      <p>
        Agencies that claim a listing must manage a real agency and keep its details accurate. We
        may edit, unpublish or remove a listing that is misleading or breaks these terms. A Verified
        badge means we&apos;ve checked basic details, not that we endorse the agency&apos;s work.
      </p>

      <h2>Featured placements</h2>
      <p>
        Featured agencies pay for placement. They are always labeled &ldquo;Featured · Paid&rdquo;
        and links to their websites are marked as sponsored.
      </p>

      <h2>Reviews</h2>
      <p>
        Reviews must describe real work with the agency. We check reviews before publishing them and
        may decline any review that looks fake, abusive or off-topic.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t send spam through our forms, scrape the site in bulk, or try to get around our
        security checks.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </LegalPage>
  );
}
