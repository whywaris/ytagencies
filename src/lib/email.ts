import "server-only";
import { Resend } from "resend";

import { BRAND_NAME, CONTACT_EMAIL, EMAIL_SENDER } from "@/lib/site";

// The only place RESEND_API_KEY is read (SECURITY.md: server-only secrets).

type Message = Parameters<Resend["emails"]["send"]>[0];

/**
 * Sender and send(), or null when email isn't configured (e.g. local dev). Every email gets
 * Reply-To CONTACT_EMAIL unless the message sets its own (lead emails reply to the business).
 */
export function getMailer() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const resend = new Resend(key);
  const from = process.env.EMAIL_FROM || `${BRAND_NAME} <${EMAIL_SENDER}>`;
  return { from, send: (msg: Message) => resend.emails.send({ replyTo: CONTACT_EMAIL, ...msg }) };
}

/** Header-safe subject: no newlines from visitor input. */
export const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 80);

/** A short plain-text alert to ADMIN_EMAIL (billing problems). Never throws; no secrets in it. */
export async function alertAdmin(subject: string, lines: string[]) {
  const mailer = getMailer();
  const to = process.env.ADMIN_EMAIL;
  if (!mailer || !to) return;
  try {
    await mailer.send({ from: mailer.from, to, subject: oneLine(subject), text: lines.join("\n") });
  } catch {
    console.error("admin alert failed", { subject: oneLine(subject) });
  }
}
