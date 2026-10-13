// The one way to send a GA4 event (components/analytics.tsx loads GA). Sends nothing without
// analytics consent or when GA isn't loaded. Only the fields typed here: never names, emails,
// messages, search text or other personal data.

export const CONSENT_KEY = "yta-consent";

type Events = {
  get_matched_submit: { service: string; industry: string };
  contact_agency_submit: { agency_slug: string };
  website_click: { agency_slug: string; utm_content: string };
  claim_start: { agency_slug: string };
  checkout_start: { interval: "month" | "year" };
  list_agency_search: { has_results: boolean };
};

type Gtag = (command: "event", name: string, params: Record<string, unknown>) => void;

export function track<E extends keyof Events>(name: E, params: Events[E]) {
  try {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (gtag && localStorage.getItem(CONSENT_KEY) === "granted") gtag("event", name, params);
  } catch {
    // Analytics must never break the page.
  }
}
