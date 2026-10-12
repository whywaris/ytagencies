import { EmailLayout, link, muted, text } from "@/emails/layout";

// To a claimed agency's owner, once, when a routed lead isn't marked contacted after 24 hours
// (daily cron, lib/lead-reminders.ts).
export function LeadReminderEmail({
  agencyName,
  business,
  url,
}: {
  agencyName: string;
  business: string;
  url: string;
}) {
  return (
    <EmailLayout preview={`${business} is waiting for a reply from ${agencyName}`}>
      <p style={text}>
        {business} sent {agencyName} an inquiry more than a day ago, and it isn&apos;t marked as
        contacted yet.
      </p>
      <p style={text}>
        <a href={url} style={link}>
          Open the lead
        </a>{" "}
        to reply. Once you have, mark it as contacted: agencies that reply quickly show it on their
        profile.
      </p>
      <p style={muted}>We only send this reminder once per inquiry.</p>
    </EmailLayout>
  );
}
