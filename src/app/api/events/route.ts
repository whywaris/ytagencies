import { createHmac } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { clientIp, hitRateLimit } from "@/lib/forms/guard";
import { LINK_SOURCES, type LinkSource } from "@/lib/outbound";
import { createAdminClient } from "@/lib/supabase/admin";

// Profile analytics beacon (ADMIN_V2_SPEC §7, SECURITY.md "Analytics beacon"). Pages stay static:
// the browser posts here with navigator.sendBeacon. Always 204, so callers learn nothing.
// Inquiries aren't accepted here: they're counted server-side when a lead is routed.

const eventSchema = z.object({
  agencyId: z.uuid(),
  type: z.enum(["profile_view", "website_click", "contact_open"]),
  // Profiles today; any site path, since website links may later sit on directory pages,
  // the home page and guides (lib/outbound.ts).
  path: z.string().regex(/^\/[a-z0-9/-]{0,300}$/),
  // Website clicks only: where the link was (its utm_content).
  source: z.enum(LINK_SOURCES as [LinkSource, ...LinkSource[]]).optional(),
});

const BOT =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|embedly|quora|whatsapp|telegram|discord|curl|wget|python|httpclient|java\/|go-http|axios|node-fetch/i;

const done = () => new Response(null, { status: 204 });

/**
 * Salted daily hash of IP + user agent: the same visitor matches within a UTC day and can't be
 * linked across days. The key is derived from CLAIM_TOKEN_SECRET with its own label, so it never
 * doubles as the claim-link key. No raw IP or user agent is stored.
 */
function visitorHash(ip: string, ua: string) {
  const secret = process.env.CLAIM_TOKEN_SECRET;
  if (!secret || secret.length < 32) return null;
  const day = new Date().toISOString().slice(0, 10);
  const key = createHmac("sha256", secret).update(`agency-events:${day}`).digest();
  return createHmac("sha256", key).update(`${ip}\n${ua}`).digest("hex").slice(0, 40);
}

export async function POST(request: NextRequest) {
  // Same-origin only: sendBeacon sends Origin, and other sites have no business posting here.
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host) return done();

  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return done();

  let parsed;
  try {
    parsed = eventSchema.safeParse(JSON.parse(await request.text()));
  } catch {
    return done();
  }
  if (!parsed.success) return done();
  const { agencyId, type, path, source } = parsed.data;

  const ip = await clientIp();
  const visitor = visitorHash(ip, ua);
  if (!visitor) {
    console.error("CLAIM_TOKEN_SECRET missing: agency events not recorded");
    return done();
  }
  if (!(await hitRateLimit("beacon", ip, 120, "1 hour"))) return done();

  const db = createAdminClient();
  const { data: agency } = await db
    .from("agencies")
    .select("id")
    .eq("id", agencyId)
    .eq("status", "published")
    .maybeSingle();
  if (!agency) return done();

  const { error } = await db.rpc("record_agency_event", {
    p_agency: agencyId,
    p_type: type,
    p_path: path,
    p_visitor: visitor,
    p_source: type === "website_click" ? (source ?? "profile") : "",
  });
  if (error) console.error("record_agency_event failed", { code: error.code });
  return done();
}
