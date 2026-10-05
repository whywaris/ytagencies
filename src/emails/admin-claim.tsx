import { Details, EmailLayout, muted, text } from "@/emails/layout";

// To the admin when a claim needs manual review (work email doesn't match the website domain).
export function AdminClaimEmail(props: {
  claimId: string;
  agencyName: string;
  website: string | null;
  workEmail: string;
  accountEmail: string | null;
}) {
  return (
    <EmailLayout preview={`Claim to review: ${props.agencyName}`}>
      <p style={text}>
        A claim needs review: the work email doesn&apos;t match the agency website.
      </p>
      <Details
        rows={[
          ["Claim ID", props.claimId],
          ["Agency", props.agencyName],
          ["Website", props.website],
          ["Work email", props.workEmail],
          ["Signed in as", props.accountEmail],
        ]}
      />
      <p style={muted}>Approve or reject it in the claims table.</p>
    </EmailLayout>
  );
}
