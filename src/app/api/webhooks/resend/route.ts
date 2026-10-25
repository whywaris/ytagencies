import { applyWebhookEvent } from "@/lib/outreach-mail";
import { verifyResendSignature, WEBHOOK_STATUS } from "@/lib/outreach-webhook";

// Resend delivery events for outreach emails: delivered, bounced, complained (lib/outreach-mail.ts).
// The Svix signature is checked on the raw body before anything is parsed; anything else is 400.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
  const body = await request.text();
  const ok = verifyResendSignature(
    body,
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    secret,
  );
  if (!ok) return new Response("Invalid signature", { status: 400 });

  let event: { type?: unknown; created_at?: unknown; data?: { email_id?: unknown } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const status = typeof event.type === "string" ? WEBHOOK_STATUS[event.type] : undefined;
  const id = event.data?.email_id;
  if (status && typeof id === "string") {
    const at = typeof event.created_at === "string" ? event.created_at : new Date().toISOString();
    await applyWebhookEvent(id, status, at);
  }
  return new Response(null, { status: 204 });
}
