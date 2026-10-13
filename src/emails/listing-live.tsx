import { EmailLayout, link, text } from "@/emails/layout";

// To the submitter (now the owner) when an admin approves their new agency.
export function ListingLiveEmail({
  agencyName,
  profileUrl,
  managed,
  nextUrl,
}: {
  agencyName: string;
  profileUrl: string;
  /** Paid for Pro at submission: already managed. */
  managed: boolean;
  /** /claim/<slug> (choose Pro) or the dashboard when already on Pro. */
  nextUrl: string;
}) {
  return (
    <EmailLayout preview={`${agencyName} is live`}>
      <p style={text}>
        Your listing is live:{" "}
        <a href={profileUrl} style={link}>
          {agencyName}
        </a>
        .
      </p>
      {managed ? (
        <p style={text}>
          You&apos;re on Pro, so businesses can contact you and you can edit it any time from your{" "}
          <a href={nextUrl} style={link}>
            dashboard
          </a>
          .
        </p>
      ) : (
        <p style={text}>
          Businesses can find it now.{" "}
          <a href={nextUrl} style={link}>
            Subscribe to Pro
          </a>{" "}
          to manage it and receive inquiries.
        </p>
      )}
    </EmailLayout>
  );
}
