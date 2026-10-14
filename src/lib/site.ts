export const BRAND_NAME = "YT Agencies";
export const SITE_DOMAIN = "ytagencies.com";
/** The one public address: contact form, legal pages, JSON-LD, Reply-To on every email. */
export const CONTACT_EMAIL = "help@ytagencies.com";
/** Sends from the Resend-verified subdomain; replies go to CONTACT_EMAIL. */
export const EMAIL_SENDER = `help@send.${SITE_DOMAIN}`;

// Absolute base for canonicals, sitemap, robots, JSON-LD and email links. Set SITE_URL per environment
// (server-side, not secret). Without it, production builds use the real domain and dev uses localhost.
// On Vercel Production a localhost SITE_URL (copied from .env.local) is ignored: canonicals and the
// sitemap must never point search engines at localhost.
const envSiteUrl =
  process.env.VERCEL_ENV === "production" &&
  /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(process.env.SITE_URL ?? "")
    ? undefined
    : process.env.SITE_URL;
export const SITE_URL = (
  envSiteUrl ??
  (process.env.NODE_ENV === "production" ? `https://${SITE_DOMAIN}` : "http://localhost:3000")
).replace(/\/$/, "");

/** The one way to build an absolute URL: absoluteUrl("/agency/acme") → https://ytagencies.com/agency/acme */
export const absoluteUrl = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

// docs/SEO.md thin-page rule: combination pages need this many published agencies to be indexed.
export const MIN_AGENCIES_TO_INDEX = 3;
