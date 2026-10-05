import { EmailLayout, link, muted, text } from "@/emails/layout";

// Sent to the work email when its domain matches the agency website.
export function ClaimVerificationEmail({ agencyName, url }: { agencyName: string; url: string }) {
  return (
    <EmailLayout preview={`Confirm you manage ${agencyName}`}>
      <p style={text}>Someone asked to manage the {agencyName} listing using this email address.</p>
      <p style={text}>
        If that was you,{" "}
        <a href={url} style={link}>
          confirm your claim
        </a>
        . You&apos;ll need to be signed in to the account you used to claim it. The link expires in
        24 hours.
      </p>
      <p style={muted}>If you didn&apos;t ask for this, ignore this email. Nothing will change.</p>
    </EmailLayout>
  );
}
