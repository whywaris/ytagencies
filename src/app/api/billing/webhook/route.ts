import { handleCreemWebhook } from "@/lib/billing/creem";

// Creem webhooks (lib/billing/creem.ts). Node runtime: the signature is an HMAC of the raw body.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleCreemWebhook(request);
}
