import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type NextRequest } from "next/server";

import { sendLeadReminders } from "@/lib/lead-reminders";
import { createAdminClient } from "@/lib/supabase/admin";

// Scheduled guides (ADMIN_V2_SPEC §8). Guide pages revalidate hourly anyway, so a scheduled guide
// shows up within an hour of its time; this daily sweep (vercel.json) refreshes the guides that
// went live since yesterday, the /guides index and the sitemap. On Vercel Pro, change the
// schedule to every 15 minutes ("*/15 * * * *") as the spec intends.
// The same daily run sends lead reminders (lib/lead-reminders.ts): Vercel Hobby allows two crons.

export const dynamic = "force-dynamic";
const WINDOW_MS = 25 * 60 * 60 * 1000; // a little over a day, so nothing slips between runs

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const now = new Date();
  const { data, error } = await createAdminClient()
    .from("guides")
    .select("slug")
    .in("status", ["published", "scheduled"])
    .gt("published_at", new Date(now.getTime() - WINDOW_MS).toISOString())
    .lte("published_at", now.toISOString());
  if (error) return Response.json({ error: "Couldn't load guides" }, { status: 500 });
  for (const g of data) {
    revalidatePath(`/guides/${g.slug}`);
    revalidatePath(`/og/guide/${g.slug}`);
  }
  revalidatePath("/guides");
  revalidatePath("/sitemaps/guides.xml");

  let reminders: unknown;
  try {
    reminders = await sendLeadReminders();
  } catch {
    reminders = { error: "Couldn't send lead reminders" };
  }
  return Response.json({ revalidated: data.length, reminders });
}
