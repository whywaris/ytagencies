import { EmailLayout, link, muted, text } from "@/emails/layout";

// /contact emails. The confirmation goes to an address typed into a public form, so it contains
// nothing the sender wrote (not even their name): it can't be used to send spam through us.

export function ContactConfirmationEmail({
  topic,
  response,
}: {
  topic: string;
  response: string | null;
}) {
  return (
    <EmailLayout preview="We've received your message">
      <p style={text}>Hi,</p>
      <p style={text}>
        We&apos;ve received your message ({topic.toLowerCase()}).
        {response ? ` We reply ${response}.` : " We'll reply as soon as we can."}
      </p>
      <p style={muted}>
        If you didn&apos;t write to us, you can ignore this email. Someone may have typed your
        address by mistake.
      </p>
    </EmailLayout>
  );
}

export function ContactAdminEmail({
  topic,
  name,
  email,
  message,
  agencyUrl,
  inboxUrl,
}: {
  topic: string;
  name: string;
  email: string;
  message: string;
  agencyUrl: string | null;
  inboxUrl: string;
}) {
  return (
    <EmailLayout preview={`${topic} from ${name}`}>
      <p style={text}>
        <strong>{topic}</strong> from {name} ({email}). Reply to this email to answer them.
      </p>
      {agencyUrl && (
        <p style={text}>
          Listing: <span style={link}>{agencyUrl}</span>
        </p>
      )}
      <p style={{ ...text, whiteSpace: "pre-wrap" }}>{message}</p>
      <p style={muted}>
        <a href={inboxUrl} style={link}>
          Open in the admin inbox
        </a>
      </p>
    </EmailLayout>
  );
}
