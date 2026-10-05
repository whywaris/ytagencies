import "server-only";
import { Resend } from "resend";

// The only place RESEND_API_KEY is read (SECURITY.md: server-only secrets).

/** Resend client and sender, or null when email isn't configured (e.g. local dev). */
export function getMailer() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return key && from ? { resend: new Resend(key), from } : null;
}

/** Header-safe subject: no newlines from visitor input. */
export const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 80);
