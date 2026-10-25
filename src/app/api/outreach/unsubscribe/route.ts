import { type NextRequest } from "next/server";

import { validUnsubscribe } from "@/lib/outreach";
import { BRAND_NAME } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// Unsubscribe from emails about a listing: "You have a project request" (lib/outreach.tsx) and the
// claim invites (lib/outreach-mail.ts). No sign-in. GET only shows a button, so
// link scanners can't unsubscribe anyone; POST (the button, or the mail client's one-click
// List-Unsubscribe-Post) records the opt-out.
export const dynamic = "force-dynamic";

const page = (body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unsubscribe | ${BRAND_NAME}</title><style>body{font:17px/1.5 system-ui,sans-serif;max-width:32em;margin:15vh auto;padding:0 16px;color:#1d1d1f}button{font:inherit;padding:10px 20px;border-radius:999px;border:0;background:#0b57d0;color:#fff;cursor:pointer}</style></head><body>${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );

const params = (request: NextRequest) => ({
  a: request.nextUrl.searchParams.get("a") ?? "",
  t: (request.nextUrl.searchParams.get("t") ?? "").slice(0, 100),
});

export async function GET(request: NextRequest) {
  const { a, t } = params(request);
  if (!validUnsubscribe(a, t)) return page("<p>This unsubscribe link isn't valid.</p>", 400);
  return page(
    `<h1>Stop emails about this listing?</h1><p>We'll stop emailing this address about this agency's listing on ${BRAND_NAME}. No sign-in needed.</p><form method="post"><button type="submit">Unsubscribe</button></form>`,
  );
}

export async function POST(request: NextRequest) {
  const { a, t } = params(request);
  if (!validUnsubscribe(a, t)) return page("<p>This unsubscribe link isn't valid.</p>", 400);
  const db = createAdminClient();
  const { error } = await db
    .from("agency_outreach_contacts")
    .update({ opted_out_at: new Date().toISOString() })
    .eq("agency_id", a)
    .is("opted_out_at", null);
  if (error) return page("<p>Something went wrong. Please try again in a minute.</p>", 500);
  // Nothing already queued for this listing goes out either.
  await db
    .from("outreach_messages")
    .update({ status: "cancelled", error: "unsubscribed" })
    .eq("agency_id", a)
    .eq("status", "queued");
  return page("<h1>You're unsubscribed</h1><p>We won't email this address about this listing again.</p>");
}
