// Resend webhook signatures (app/api/webhooks/resend). Pure: tested in tests/outreach.test.mjs.
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend signs webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body" with the base64 key
 * after "whsec_", sent as "v1,<base64>" (several, space-separated). Refuses anything older or
 * newer than 5 minutes.
 */
export function verifyResendSignature(
  body: string,
  h: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!h.id || !h.timestamp || !h.signature || !secret.startsWith("whsec_")) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 300) return false;
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const expected = Buffer.from(
    createHmac("sha256", key).update(`${h.id}.${h.timestamp}.${body}`).digest("base64"),
  );
  return h.signature.split(" ").some((part) => {
    const [version, sig = ""] = part.split(",");
    const got = Buffer.from(sig);
    return version === "v1" && got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** Resend event type → our status (others are ignored). */
export const WEBHOOK_STATUS: Record<string, "delivered" | "bounced" | "complained"> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};
