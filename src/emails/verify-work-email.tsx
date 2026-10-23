import { EmailLayout, link, muted, text } from "@/emails/layout";

// Sent to the work email an agency gave when asking for the Verified badge: clicking the link
// proves the agency's domain and sends the request to our review queue.
export function VerifyWorkEmail({
  agencyName,
  domain,
  url,
}: {
  agencyName: string;
  domain: string;
  url: string;
}) {
  return (
    <EmailLayout preview={`Confirm ${domain} for ${agencyName}'s Verified badge`}>
      <p style={text}>
        {agencyName} asked for the Verified badge on YT Agencies using this email address at{" "}
        {domain}.
      </p>
      <p style={text}>
        If that was you,{" "}
        <a href={url} style={link}>
          confirm this email
        </a>
        . Your request then goes to our review, where we also check your website, YouTube channels
        and that your business is real. The link works once and expires in 24 hours.
      </p>
      <p style={muted}>If you didn&apos;t ask for this, ignore this email. Nothing will change.</p>
    </EmailLayout>
  );
}
