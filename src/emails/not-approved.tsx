import { EmailLayout, muted, text } from "@/emails/layout";

// To the person whose submission, claim or review an admin rejected. The reason is optional and
// written by the admin; when there's none, the email just says it wasn't approved.
export function NotApprovedEmail({
  what,
  reason,
}: {
  /** e.g. "Your listing for Acme Media", "Your claim for Acme Media", "Your review of Acme Media" */
  what: string;
  reason: string | null;
}) {
  return (
    <EmailLayout preview={`${what} wasn't approved`}>
      <p style={text}>{what} wasn&apos;t approved.</p>
      {reason ? (
        <>
          <p style={{ ...text, marginBottom: "4px", fontWeight: 600 }}>Our note</p>
          <p style={{ ...text, whiteSpace: "pre-wrap" }}>{reason}</p>
        </>
      ) : null}
      <p style={muted}>
        If you think this is a mistake, reply to this email and we&apos;ll take another look.
      </p>
    </EmailLayout>
  );
}
