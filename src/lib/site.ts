export const BRAND_NAME = "YT Agencies";
export const SITE_DOMAIN = "ytagencies.com";
export const CONTACT_EMAIL = "hello@ytagencies.com";

// Absolute base for canonicals, sitemap, robots, JSON-LD and email links. Set SITE_URL per environment
// (server-side, not secret). Without it, production builds use the real domain and dev uses localhost.
export const SITE_URL = (
  process.env.SITE_URL ??
  (process.env.NODE_ENV === "production" ? `https://${SITE_DOMAIN}` : "http://localhost:3000")
).replace(/\/$/, "");

/** The one way to build an absolute URL: absoluteUrl("/agency/acme") → https://ytagencies.com/agency/acme */
export const absoluteUrl = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

// docs/SEO.md thin-page rule: combination pages need this many published agencies to be indexed.
export const MIN_AGENCIES_TO_INDEX = 3;
