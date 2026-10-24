import { EmailLayout, link, muted, text } from "@/emails/layout";
import { BRAND_NAME } from "@/lib/site";

// To an unclaimed listing's address on file, once per request (lib/outreach.tsx). No details of
// the request: claiming the free profile shows the preview.
export function AgencyOutreachEmail({
  agencyName,
  claimUrl,
  unsubscribeUrl,
}: {
  agencyName: string;
  claimUrl: string;
  unsubscribeUrl: string;
}) {
  return (
    <EmailLayout preview={`You have a project request on ${BRAND_NAME}`}>
      <p style={text}>
        You have a project request on {BRAND_NAME}. Claim your free profile to see it.
      </p>
      <p style={text}>
        <a href={claimUrl} style={link}>
          Claim {agencyName} for free
        </a>
      </p>
      <p style={muted}>
        Why you got this: {agencyName} is listed in the {BRAND_NAME} directory, and a business sent a
        request from its profile.{" "}
        <a href={unsubscribeUrl} style={link}>
          Unsubscribe
        </a>{" "}
        and we won&apos;t email this address again.
      </p>
    </EmailLayout>
  );
}
