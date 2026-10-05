import { Details, EmailLayout, link, muted, text } from "@/emails/layout";

type Props = {
  agencyName: string;
  lead: {
    name: string;
    email: string;
    company?: string | null;
    budget?: string | null;
    need?: string | null;
    message?: string | null;
  };
  direct: boolean;
};

// To a claimed agency's owner when a lead is routed to them.
export function AgencyLeadEmail({ agencyName, lead, direct }: Props) {
  return (
    <EmailLayout preview={`New inquiry for ${agencyName} from ${lead.name}`}>
      <p style={text}>
        {direct
          ? `${lead.name} sent ${agencyName} a message through your listing.`
          : `${lead.name} is looking for an agency and matched with ${agencyName}.`}
      </p>
      <Details
        rows={[
          ["Name", lead.name],
          ["Email", lead.email],
          ["Company", lead.company],
          ["Looking for", lead.need],
          ["Budget", lead.budget],
          ["Message", lead.message],
        ]}
      />
      <p style={text}>
        Reply directly to{" "}
        <a href={`mailto:${lead.email}`} style={link}>
          {lead.email}
        </a>
        . {direct ? "" : "Other matched agencies may have received this request too."}
      </p>
      <p style={muted}>Please use these details only to respond to this inquiry.</p>
    </EmailLayout>
  );
}
