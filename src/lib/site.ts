export const BRAND_NAME = "AgencyTube";

// LAUNCH: replace with a real, monitored inbox (shown on /privacy and /terms).
export const CONTACT_EMAIL = "hello@agencytube.example";

// Absolute base for canonicals, sitemap and JSON-LD. Set SITE_URL in production (server-side, not secret).
export const SITE_URL = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

// docs/SEO.md thin-page rule: combination pages need this many published agencies to be indexed.
export const MIN_AGENCIES_TO_INDEX = 3;
