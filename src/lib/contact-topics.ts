import { COMPANY } from "@/lib/company";

// /contact topics: label, which inbox gets the message, and the note shown under the selector.
// Shared by the form (client), the server action and the side column. Ids must stay in the
// database's contact_messages_topic_check.

export const CONTACT_TOPICS = [
  {
    id: "general",
    label: "General question",
    inbox: COMPANY.email,
    note: "A question about a guide, a correction, or anything else.",
    response: COMPANY.responseTimes.general,
  },
  {
    id: "press",
    label: "Press",
    inbox: COMPANY.email,
    note: "Interviews, data requests and other media questions.",
    response: COMPANY.responseTimes.general,
  },
  {
    id: "privacy",
    label: "Privacy request",
    inbox: COMPANY.email,
    note: `A copy of your data, a correction or deletion. We answer ${COMPANY.responseTimes.privacy}.`,
    response: COMPANY.responseTimes.privacy,
  },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["id"];
export const TOPIC_IDS = CONTACT_TOPICS.map((t) => t.id) as [ContactTopic, ...ContactTopic[]];

// From when the site was an agency directory: no longer offered, kept so older messages in the
// Inbox keep their label.
const OLD_TOPICS = [
  { id: "agencies", label: "For agencies" },
  { id: "report", label: "Report a listing" },
  { id: "pro", label: "Pro request" },
  { id: "access", label: "Access request" },
  { id: "removal", label: "Removal request" },
].map((t) => ({ ...t, inbox: COMPANY.email, note: "", response: null }));

export const INBOX_TOPICS = [...CONTACT_TOPICS, ...OLD_TOPICS] as const;
export const topicOf = (id: string) => INBOX_TOPICS.find((t) => t.id === id) ?? CONTACT_TOPICS[0];
