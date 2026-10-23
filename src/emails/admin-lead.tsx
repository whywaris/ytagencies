import { Details, EmailLayout, muted, text } from "@/emails/layout";

type Props = {
  leadId: string;
  kind: "get-matched" | "contact";
  lead: {
    name: string;
    email: string;
    company?: string | null;
    budget?: string | null;
    need?: string | null;
    details?: [string, string | null][];
  };
  routes: { name: string; notified: boolean }[];
};

// To the site admin for every new lead. Flags routes that need forwarding by hand.
export function AdminLeadEmail({ leadId, kind, lead, routes }: Props) {
  const manual = routes.filter((r) => !r.notified);
  return (
    <EmailLayout preview={`New ${kind} lead from ${lead.name}`}>
      <p style={text}>New {kind === "contact" ? "contact form" : "proposal request"} lead.</p>
      <Details
        rows={[
          ["Lead ID", leadId],
          ["Name", lead.name],
          ["Email", lead.email],
          ["Company", lead.company],
          ["Looking for", lead.need],
          ["Budget", lead.budget],
          ...(lead.details ?? []),
          [
            "Routed to",
            routes.length
              ? routes.map((r) => `${r.name}${r.notified ? "" : " (not notified)"}`).join("\n")
              : "No matching agency",
          ],
        ]}
      />
      {(manual.length > 0 || routes.length === 0) && (
        <p style={text}>
          {routes.length === 0
            ? "No agency matched. Find one and reply to the business."
            : "Agencies marked “not notified” have no claimed owner or the email failed. Forward this lead to them by hand."}
        </p>
      )}
      <p style={muted}>The full message is in the leads table.</p>
    </EmailLayout>
  );
}
