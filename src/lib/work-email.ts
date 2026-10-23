// Company-domain email checks for the Verified badge and claims, and the one-time link token.
// Pure (node:crypto only): tested in tests/work-email.test.mjs.

import { createHmac, timingSafeEqual } from "node:crypto";

/** Free and personal mailbox providers: never proof of working at an agency. */
export const FREE_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "zoho.com",
  "zohomail.com",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "web.de",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "mail.ru",
  "qq.com",
  "163.com",
  "126.com",
  "fastmail.com",
  "tutanota.com",
  "tuta.io",
  "hey.com",
  "hushmail.com",
];

/** Throwaway inboxes. */
export const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "10minutemail.com",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "throwawaymail.com",
  "mohmal.com",
  "emailondeck.com",
  "fakeinbox.com",
  "mintemail.com",
  "mytemp.email",
  "tempr.email",
  "discard.email",
];

/** Site builders and profiles: a website here isn't the agency's own domain. */
const HOSTED_PLATFORMS = [
  "wixsite.com",
  "wix.com",
  "squarespace.com",
  "webflow.io",
  "carrd.co",
  "notion.site",
  "sites.google.com",
  "blogspot.com",
  "wordpress.com",
  "github.io",
  "vercel.app",
  "netlify.app",
  "linktr.ee",
  "about.me",
  "youtube.com",
  "instagram.com",
  "facebook.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "behance.net",
  "fiverr.com",
  "upwork.com",
];

const BLOCKED = new Set([...FREE_EMAIL_DOMAINS, ...DISPOSABLE_EMAIL_DOMAINS]);
const under = (domain: string, list: Iterable<string>) => {
  for (const d of list) if (domain === d || domain.endsWith(`.${d}`)) return true;
  return false;
};

/** A website's host, lowercased, without "www."; null if it isn't a usable URL. */
export function websiteHost(website: string | null | undefined) {
  if (!website) return null;
  try {
    const host = new URL(website).hostname.toLowerCase().replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

/** The agency's own domain to verify against, or null (no website, or a builder/profile URL). */
export function ownDomain(website: string | null | undefined) {
  const host = websiteHost(website);
  return host && !under(host, HOSTED_PLATFORMS) && !under(host, BLOCKED) ? host : null;
}

export const isFreeOrDisposable = (domain: string) => under(domain.toLowerCase(), BLOCKED);

export const NO_OWN_DOMAIN = "Verification needs an email at your agency's own website domain.";

/**
 * Why this email can't prove the agency's domain, or null when it can: it must be on the
 * website's domain or a subdomain of it (www ignored), and never a free or disposable provider.
 */
export function workEmailProblem(email: string, website: string | null | undefined) {
  const domain = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(email.trim())?.[1]?.toLowerCase();
  if (!domain) return "Enter a valid email address.";
  if (isFreeOrDisposable(domain))
    return "Use your work email at your agency's domain, not a personal or temporary one.";
  const own = ownDomain(website);
  if (!own) return NO_OWN_DOMAIN;
  if (domain !== own && !domain.endsWith(`.${own}`))
    return `Use an email at ${own}, your agency's website domain.`;
  return null;
}

/** Same rule as workEmailProblem, as a yes/no (claims). */
export const emailOnOwnDomain = (email: string, website: string | null | undefined) =>
  workEmailProblem(email, website) === null;

export const LINK_TTL_SECONDS = 24 * 60 * 60;

const mac = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(`verification:${payload}`).digest("base64url");

/** "<id>.<expiresAtSeconds>.<hmac>": the work-email link, valid 24 hours. */
export function signLinkToken(id: string, secret: string, now = Date.now()) {
  const payload = `${id}.${Math.floor(now / 1000) + LINK_TTL_SECONDS}`;
  return `${payload}.${mac(payload, secret)}`;
}

/** The id if the token is authentic and unexpired, else null. Single use is up to the caller. */
export function readLinkToken(token: string, secret: string, now = Date.now()) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, expires, given] = parts;
  const expected = Buffer.from(mac(`${id}.${expires}`, secret));
  const got = Buffer.from(given);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  if (!/^\d+$/.test(expires) || Number(expires) * 1000 < now) return null;
  return id;
}
