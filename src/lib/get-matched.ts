// Request proposals prefill: ?service=&industry= from the home finder, directory pages and profiles,
// ?ref= (where it started) and ?need= (the 404 page's search box). Unknown slugs are ignored.
// Pure, no imports: tested.

export const STEP1_FIELDS = ["service", "industry", "goal", "budget", "start"] as const;

export function prefillFrom(search: string, services: string[], industries: string[]) {
  const q = new URLSearchParams(search);
  const service = q.get("service") ?? "";
  const industry = q.get("industry") ?? "";
  const ref = q.get("ref") ?? "";
  const known = {
    service: services.includes(service) ? service : "",
    industry: industries.includes(industry) ? industry : "",
  };
  return {
    ...known,
    ref: /^[a-z]+(:[a-z0-9-]{1,80})?$/.test(ref) ? ref : "",
    message: (q.get("need") ?? "").trim().slice(0, 500),
    /** Show "Filled in from your search" when either select was set from the link. */
    fromSearch: !!(known.service || known.industry),
  };
}
