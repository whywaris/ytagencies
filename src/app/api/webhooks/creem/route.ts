import { handleCreemWebhook } from "@/lib/billing/creem";

// Same handler as /api/billing/webhook: Creem endpoints set up with this URL keep working.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleCreemWebhook(request);
}
