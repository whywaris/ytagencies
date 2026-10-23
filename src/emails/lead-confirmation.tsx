import { Details, EmailLayout, link, muted, text } from "@/emails/layout";

type Props = {
  name: string;
  agencies: { name: string; url: string }[];
  /** e.g. "YouTube Ads for Doctors & clinics"; omitted for a direct message to one agency */
  need?: string;
  /** Request proposals: their answers, so they have a copy. */
  answers?: [string, string | null][];
};

// To the business, right after they submit.
export function LeadConfirmationEmail({ name, agencies, need, answers }: Props) {
  const direct = !need;
  return (
    <EmailLayout
      preview={
        direct
          ? "Your message was sent"
          : agencies.length > 0
            ? "We've passed your request to agencies that fit"
            : "We've saved your request"
      }
    >
      <p style={text}>Hi {name},</p>
      {agencies.length > 0 ? (
        <>
          <p style={text}>
            {direct
              ? `We've sent your message to ${agencies[0].name}.`
              : `We've passed your request for ${need} to ${agencies.length === 1 ? "this agency" : `these ${agencies.length} agencies`}:`}
          </p>
          {!direct && (
            <ul style={{ ...text, paddingLeft: "20px" }}>
              {agencies.map((a) => (
                <li key={a.url}>
                  <a href={a.url} style={link}>
                    {a.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p style={text}>
            {direct ? "They can" : "Interested agencies can"} reply to you directly at this email
            address. You don&apos;t need to do anything else.
          </p>
        </>
      ) : (
        <p style={text}>
          We&apos;ve got your request for {need}. No agency on our list fits it yet. We&apos;ll
          email you if one does.
        </p>
      )}
      {answers && answers.some(([, v]) => v) && (
        <>
          <p style={text}>Your request:</p>
          <Details rows={answers} />
        </>
      )}
      <p style={muted}>
        You&apos;re getting this because you submitted a form on our site. To have your details
        deleted, reply to this email.
      </p>
    </EmailLayout>
  );
}
