// GA4 in the browser: when it may load, and the one way to send an event
// (components/analytics.tsx loads GA). No imports: tests load this file directly.
//
// Never for signed-in visitors, on any page: a Supabase session is a readable cookie
// (@supabase/ssr, "sb-<project>-auth-token", split into .0/.1 when long), so checking for it is a
// local read with no network call and pages stay static. Never on private routes either.
// Events carry only the fields typed here: never names, emails, messages, search text or other
// personal data.

export const CONSENT_KEY = "yta-consent";

const PRIVATE_ROUTE = /^\/(admin|dashboard|login|claim|auth)(\/|$)/;
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=[^;]+/;

/** A Supabase session cookie is present (signed in, in this browser). */
export const hasSession = (cookie: string) => SESSION_COOKIE.test(cookie);

/** GA may load: a public route and nobody signed in. */
export const shouldLoadGa = ({ pathname, cookie }: { pathname: string; cookie: string }) =>
  !PRIVATE_ROUTE.test(pathname) && !hasSession(cookie);

type Events = {
  /** Request proposals sent: the choices only, never contact details. */
  lead_submitted: { service: string; industry: string; budget_range: string; goal: string };
  contact_agency_submit: { agency_slug: string };
  website_click: { agency_slug: string; utm_content: string };
  claim_start: { agency_slug: string };
  checkout_start: { interval: "month" | "year" };
  list_agency_search: { has_results: boolean };
  /** /agencies after filtering: which filters (keys only, never the search text) and how many. */
  agency_search: { filters: string; results: number };
  /** The 404 page: the path only, never the query string. */
  page_not_found: { path: string };
};

type Gtag = (command: "event", name: string, params: Record<string, unknown>) => void;

export function track<E extends keyof Events>(name: E, params: Events[E]) {
  try {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (
      gtag &&
      localStorage.getItem(CONSENT_KEY) === "granted" &&
      shouldLoadGa({ pathname: location.pathname, cookie: document.cookie })
    )
      gtag("event", name, params);
  } catch {
    // Analytics must never break the page.
  }
}
