// Outbound links to agency websites (docs/SEO.md "Outbound links"). One helper for every place
// that links to an agency's site, so the rel rules and UTM tags never drift. No imports: tested.

/** Where the click came from: utm_content and the website_click event's source. */
export type LinkSource = "profile" | "directory" | "home_hero" | "guide";
export const LINK_SOURCES: readonly LinkSource[] = ["profile", "directory", "home_hero", "guide"];

const PAID_PLANS = new Set(["pro"]);

/**
 * The website link for an agency, or null when it gets none (not managed, or no usable http(s)
 * website). Paid links are rel="sponsored noopener" and open in a new tab. Never "noreferrer":
 * with our Referrer-Policy (strict-origin-when-cross-origin) the agency's analytics sees
 * ytagencies.com as the referrer, alongside the UTM tags. The agency's own query string is kept;
 * our utm_* values replace any utm_* it already had, so none appear twice.
 */
export function agencyWebsiteLink(website: string | null, plan: string, source: LinkSource) {
  if (!website || !PAID_PLANS.has(plan)) return null;
  let url: URL;
  try {
    url = new URL(website);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.searchParams.set("utm_source", "ytagencies");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", "directory_listing");
  url.searchParams.set("utm_content", source);
  return {
    href: url.href,
    /** "acmemedia.com" */
    label: url.hostname.replace(/^www\./, ""),
    rel: "sponsored noopener",
    target: "_blank",
  } as const;
}
