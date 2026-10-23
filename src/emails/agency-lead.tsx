import { Details, EmailLayout, link, muted, text } from "@/emails/layout";
import { BRAND_NAME } from "@/lib/site";

type Props = {
  agencyName: string;
  lead: {
    name: string;
    email: string;
    company?: string | null;
    budget?: string | null;
    need?: string | null;
    message?: string | null;
    /** Request proposals answers: goal, start, website, channel, customers, past agencies. */
    details?: [string, string | null][];
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
          : `${lead.name} sent a project request that fits ${agencyName}.`}
      </p>
      <Details
        rows={[
          ["Name", lead.name],
          ["Email", lead.email],
          ["Company", lead.company],
          ["Looking for", lead.need],
          ["Budget", lead.budget],
          ...(lead.details ?? []),
          ["Message", lead.message],
        ]}
      />
      <p style={text}>
        Reply directly to{" "}
        <a href={`mailto:${lead.email}`} style={link}>
          {lead.email}
        </a>
        . {direct ? "" : "Other agencies that fit may have received this request too."}
      </p>
      <p style={muted}>
        {direct
          ? `This inquiry came from your ${BRAND_NAME} profile.`
          : `This inquiry came from ${BRAND_NAME}, where the request fit your profile.`}{" "}
        Please use these details only to respond to it.
      </p>
    </EmailLayout>
  );
}
