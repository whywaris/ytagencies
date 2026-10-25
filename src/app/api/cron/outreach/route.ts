import { timingSafeEqual } from "node:crypto";
import { type NextRequest } from "next/server";

import { runOutreach } from "@/lib/outreach-mail";

// Outreach emails (lib/outreach-mail.ts). Vercel Hobby allows only daily crons, so a GitHub
// Actions schedule (.github/workflows/outreach.yml) calls this every hour, 09:00–17:00 UTC on
// weekdays, with CRON_SECRET. Each run sends its share of the daily cap; outside the window it
// sends nothing. The response holds counts only.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await runOutreach());
  } catch {
    console.error("outreach cron failed");
    return new Response("Failed", { status: 500 });
  }
}
