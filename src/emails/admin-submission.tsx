import { Details, EmailLayout, link, muted, text } from "@/emails/layout";

// To the admin for every new agency submitted through /list-your-agency.
export function AdminSubmissionEmail(props: {
  agencyName: string;
  website: string;
  workEmail: string;
  accountEmail: string | null;
  domainMatches: boolean;
  reviewUrl: string;
}) {
  return (
    <EmailLayout preview={`New agency submitted: ${props.agencyName}`}>
      <p style={text}>A new agency was submitted. It stays a draft until you publish it.</p>
      <Details
        rows={[
          ["Agency", props.agencyName],
          ["Website", props.website],
          ["Work email", props.workEmail],
          [
            "Domain check",
            props.domainMatches
              ? "Matches the website. We emailed them a confirmation link."
              : "Doesn't match the website",
          ],
          ["Signed in as", props.accountEmail],
        ]}
      />
      <p style={muted}>
        Approve or reject it in{" "}
        <a href={props.reviewUrl} style={link}>
          New submissions
        </a>
        .
      </p>
    </EmailLayout>
  );
}
