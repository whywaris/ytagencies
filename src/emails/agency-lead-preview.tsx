import { Details, EmailLayout, link, muted, text } from "@/emails/layout";
import type { LeadPreview } from "@/lib/lead-preview";

// To a claimed agency's owner who isn't on Pro: the request without contact details
// (lib/lead-preview.ts). Never the visitor's name, email, company, links or full message.
export function AgencyLeadPreviewEmail({
  agencyName,
  preview,
  url,
  direct,
}: {
  agencyName: string;
  preview: LeadPreview;
  /** The dashboard's inquiries page. */
  url: string;
  /** Sent from the agency's own profile (it can fall back to similar agencies after 48 hours). */
  direct: boolean;
}) {
  return (
    <EmailLayout preview={`New project request for ${agencyName}`}>
      <p style={text}>
        {direct
          ? `A business sent ${agencyName} a project request from your profile.`
          : `A business sent a project request that fits ${agencyName}.`}
      </p>
      <Details
        rows={[
          ["Service", preview.service],
          ["Niche", preview.industry],
          ["Budget", preview.budget],
          ["Wants to start", preview.timeline],
          ["Main goal", preview.goal],
          ["Country", preview.country],
          ["Summary", preview.summary],
        ]}
      />
      <p style={text}>
        <a href={url} style={link}>
          Upgrade to Pro to see contact details and reply.
        </a>
      </p>
      {direct && (
        <p style={muted}>
          If nobody on Pro opens or answers it within 48 hours, the business asked us to send it to
          up to 3 similar agencies.
        </p>
      )}
    </EmailLayout>
  );
}
