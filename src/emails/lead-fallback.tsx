import { EmailLayout, link, muted, text } from "@/emails/layout";

// To the business, when its profile request moves on after 48 hours (lib/lead-fallback.tsx).
export function LeadFallbackEmail({
  name,
  agencyName,
  agencies,
}: {
  name: string;
  agencyName: string;
  agencies: { name: string; url: string }[];
}) {
  return (
    <EmailLayout preview={`We've sent your request to ${agencies.length} similar agencies`}>
      <p style={text}>Hi {name},</p>
      <p style={text}>
        {agencyName} didn&apos;t reply within 48 hours, so, as you asked, we&apos;ve sent your
        request to {agencies.length === 1 ? "this similar agency" : `these ${agencies.length} similar agencies`}:
      </p>
      <ul style={{ ...text, paddingLeft: "20px" }}>
        {agencies.map((a) => (
          <li key={a.url}>
            <a href={a.url} style={link}>
              {a.name}
            </a>
          </li>
        ))}
      </ul>
      <p style={text}>They can reply to you directly at this email address.</p>
      <p style={muted}>
        You&apos;re getting this because you sent a request on our site. To have your details
        deleted, reply to this email.
      </p>
    </EmailLayout>
  );
}
