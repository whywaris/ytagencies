// Pro booking buttons: a Calendly link and a WhatsApp number on the profile. Pure, no imports:
// tests load this file directly. The database checks the same formats (schema.sql).

const CALENDLY = /^https:\/\/(www\.)?calendly\.com\/[A-Za-z0-9/_-]+$/;

/** A calendly.com link (https://calendly.com/<you>/…), "" for none, or null when it isn't one. */
export function parseCalendly(raw: string): string | null {
  const v = raw
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  if (v === "") return "";
  const url = /^https?:\/\//i.test(v) ? v.replace(/^http:/i, "https:") : `https://${v}`;
  return CALENDLY.test(url) && url.length <= 300 ? url : null;
}

/**
 * A WhatsApp number with its country code ("+92 300 1234567") or a wa.me link, as digits only;
 * "" for none, or null when it isn't one.
 */
export function parseWhatsApp(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return "";
  const link = v.match(/^(?:https?:\/\/)?(?:www\.)?wa\.me\/(\+?[0-9]+)\/?$/i);
  if (!link && /[a-z]/i.test(v)) return null;
  const digits = (link ? link[1] : v).replace(/[\s().+-]/g, "");
  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : null;
}

/** The buttons a profile shows: only while the agency is on Pro, and only links we built. */
export function bookingLinks(
  agency: { calendlyUrl: string | null; whatsappNumber: string | null },
  managed: boolean,
) {
  if (!managed) return [];
  const calendly = agency.calendlyUrl ? parseCalendly(agency.calendlyUrl) : null;
  const whatsapp = agency.whatsappNumber ? parseWhatsApp(agency.whatsappNumber) : null;
  return [
    ...(calendly ? [{ kind: "calendly" as const, label: "Book a call", href: calendly }] : []),
    ...(whatsapp
      ? [{ kind: "whatsapp" as const, label: "WhatsApp", href: `https://wa.me/${whatsapp}` }]
      : []),
  ];
}
