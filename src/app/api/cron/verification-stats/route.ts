import { timingSafeEqual } from "node:crypto";
import { type NextRequest } from "next/server";

import { adminLogger } from "@/lib/admin-log";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { fetchChannel, withCheck, type ChannelStats, type StatsSnapshot } from "@/lib/youtube";

// Monthly re-check of verified agencies' YouTube stats (ADMIN_V2_SPEC §5.4). Scheduled in
// vercel.json; Vercel sends `Authorization: Bearer <CRON_SECRET>`. Each check is appended to
// stats_snapshot (latest + up to 24 earlier). A channel that fails to load leaves that agency's
// snapshot untouched until next month.

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("verifications")
    .select("id, agency_id, stats_snapshot")
    .eq("status", "approved")
    .not("stats_snapshot", "is", null);
  if (error) return Response.json({ error: "Couldn't load verifications" }, { status: 500 });

  let updated = 0;
  let failed = 0;
  for (const v of data) {
    const snapshot = v.stats_snapshot as StatsSnapshot | null;
    const ids = snapshot?.latest.channels.map((c) => c.channelId) ?? [];
    if (!ids.length) continue;
    const fresh = [];
    for (const id of ids) fresh.push(await fetchChannel({ kind: "id", value: id }));
    if (fresh.some((f) => typeof f === "string")) {
      failed++;
      continue;
    }
    const { error: saveError } = await db
      .from("verifications")
      .update({ stats_snapshot: withCheck(snapshot, fresh as ChannelStats[]) as Json })
      .eq("id", v.id);
    if (saveError) failed++;
    else updated++;
  }

  // Recorded in the audit log as a system action (no admin).
  await adminLogger(db, null)("verification.recheck", "system", null, { updated, failed });
  return Response.json({ updated, failed });
}
