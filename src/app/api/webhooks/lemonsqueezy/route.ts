import { handleWebhook } from "@/lib/billing/lemonsqueezy";

// Lemon Squeezy webhooks (lib/billing/lemonsqueezy.ts). Node runtime: the signature is an HMAC of
// the raw body, so the body is read as text before anything parses it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleWebhook(await request.text(), request.headers);
}
