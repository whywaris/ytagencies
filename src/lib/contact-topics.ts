import { COMPANY } from "@/lib/company";

// /contact topics: label, which inbox gets the message, and the note shown under the selector.
// Shared by the form (client), the server action and the side column.

export const CONTACT_TOPICS = [
  {
    id: "general",
    label: "General question",
    inbox: COMPANY.email,
    note: "Questions about the directory, an inquiry you sent, or anything else.",
    response: COMPANY.responseTimes.general,
  },
  {
    id: "agencies",
    label: "For agencies",
    inbox: COMPANY.email,
    note: "Listings, claims, verification, plans and billing.",
    response: COMPANY.responseTimes.agencies,
  },
  {
    id: "report",
    label: "Report a listing",
    inbox: COMPANY.email,
    note: "Tell us which listing and what's wrong with it: wrong details, fake reviews or an agency that isn't real.",
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

// Not on /contact: "Request Pro" on the pricing page and dashboard (lib/actions/pro.tsx) while
// payments are off. Shown in Admin → Inbox with the other topics.
export const PRO_TOPIC = {
  id: "pro",
  label: "Pro request",
  inbox: COMPANY.email,
  note: "An agency asked for Pro. Grant it in Agencies → Change plan.",
  response: COMPANY.responseTimes.agencies,
} as const;
export const INBOX_TOPICS = [...CONTACT_TOPICS, PRO_TOPIC] as const;
export const topicOf = (id: string) => INBOX_TOPICS.find((t) => t.id === id) ?? CONTACT_TOPICS[0];
